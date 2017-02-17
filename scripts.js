//=========================================================================================
// Code is adapted from Kerry Rodden's "Zoomable sunburst with updating data" 
// (http://bl.ocks.org/kerryrodden/477c1bfb081b783f80ad) and "Sequences Sunburst" 
// (https://bl.ocks.org/kerryrodden/7090426) Blocks
// And Joshuah Latimore’s Block "JsonToPartiontion"
// Found here http://bl.ocks.org/jsl6906/ad15363febc1be45301b
//
// Author: Luke Goertzen
// Purpose: JS and D3 for ETD Visualization App
//=========================================================================================


//=========================================================================================
// Input CSV Formatting and Info
//=========================================================================================
// This code expects the input csv to have the following column names and mapping, in the given order
// Expected                 Default may be              Represents
// id                       id.only                     Id for thesis
// url                      dc.identifier.uri           Link to thesis page in OSU Scholars Archive
// author                   dc.creator                  Author of a given thesis
// title                    dc.title                    Title of a given thesis
// year                     dc.description              Year thesis was submitted
// multiple_grad_year       multiple grad year          Whether author had multiple graduation years
// degree_level             dc.degree.level             Degree level of author when thesis submitted (i.e Doctoral, Masters, Bachelors)
// degree_fullName          dc.degree.name              Full degree name (e.g. Master's of Science (M.S.) in Chemistry)
// degree_type              dc.degree.name 1            First half of full degree name (e.g. Master's of Science (M.S.), Doctor of Philosophy (Ph.D), etc.)
// degree_field             dc.degree.name 2            Second half of full degree name, which is a field of study (e.g. Agriculture, Chemistry, Computer Science, etc.)
// degree_topic             dc.degree.topic             Groups degree fields into ~20 categories - used to filter visualizer
// downloads                downloads                   Number of downloads for a given thesis



//=========================================================================================
// Setup and global variables
//=========================================================================================

// Used to put slight delay before redrawing graph after window resize
var globalResizeTimer = null;

// Dimensions of the page
width =  window.innerWidth  || document.documentElement.clientWidth  || document.body.clientWidth;
height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

// Radius of visualization
radius = Math.min(width, height)*(.35);

// Color scale for first level of nodes
var hue = d3.scale.category20();

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
var b = {w: 125, h: 30, s: 3, t: 10};

// SVG that contains the chart
var svg = d3.select('#graph').append('svg')
    .attr('id', 'visualization')
    .attr('width',  width)
    .attr('height', height)
  .append('g')
    .attr('transform', 'translate('+(width/2)+','+(height/2 - 75)+')');

// Used to calculate paths for the node blocks
var arc = d3.svg.arc()
    .startAngle( function(d) { return d.x; })
    .endAngle(   function(d) { return d.x + d.dx ; })
    .innerRadius(function(d) { return radius / 3 * d.depth; })
    .outerRadius(function(d) { return radius / 3 * (d.depth + 1) - 0.1; });

// Used when drawing a white border around graph for smoother animations
var borderArc = d3.svg.arc()
  		.innerRadius(radius)
  		.outerRadius(radius+200)
  		.startAngle(0)
  		.endAngle(2 * Math.PI);



// Global Variables
var path;                         // All the paths to of the visualization svg 
var partition;                    // The d3 partition type
var currentRoot;                  // The root of the graph based on sort/filter - not influenced by zoom
var currentCenter;                // The center node of the graph currently - changes with zoom
var parsedCSV;                    // A preserved copy of the CSV without filtering
var pathLevel = [];               // The text in the center of the graphic providing info of current node hovered over

var currentSortType = 1;          // The order that the hierarchy tree levels are sorted
var currentFilterType = 'none';   // Whether the theses are sorted to a given degree name

var freezeBreadCrumb = false;     // Freeze the breadcrumb trail when an individual theses is clicked



//=========================================================================================
// Parse CSV, Draw SVG and handle transistions
//=========================================================================================
d3.csv('CleanCSV.csv', function (error, data) {
  parsedCSV = data;                                   // Cache unfiltered array of the parsed data
  populateFilterList(getAllDegreeTopics(parsedCSV));  // Create options in filter drop-down menu
  root = formatPartition(parsedCSV);               // Turn csv data array into properly formatted hierarchy for sunburst graph
  currentRoot = currentCenter = root;                 // Initializd references to root
  createInfoLabels(root);                             // Creates elements to display relevant info about current node
  drawGraph();                                        // Inital draw paths for node blocks 
  initializeBreadcrumbTrail();                        // Create breadcrumb path and put name of root in first block
  updateBreadcrumbs([]);                              // Start displaying breadcrumbs

});  
//=========================================================================================

//=========================================================================================
// Resizing functionality
//=========================================================================================

// Resise the visual if the window changes size
window.onresize = resizeDelay;

// Calls resize function 150ms after window resize
function resizeDelay() {
  if(globalResizeTimer != null) window.clearTimeout(globalResizeTimer);
    globalResizeTimer = window.setTimeout(function() {resizeGraph();}, 150);
}

// Adjusts content to fit window
function resizeGraph() {
  // Update the global variables and setup to reflect new window size

  width =  window.innerWidth  || document.documentElement.clientWidth  || document.body.clientWidth;
  height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  radius = Math.min(width, height)*(.35);

  // Remove current graph
  var div = document.getElementById('graph');
  while(div.firstChild){ div.removeChild(div.firstChild); }

  // Create new svg
  svg = d3.select("#graph").append("svg")
      .attr("width",  width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate("+(width/2)+","+(height/2 - 75)+")");

  // Redefine arc used for border 
  borderArc = d3.svg.arc()
  		.innerRadius(radius)
  		.outerRadius(radius+200)
  		.startAngle(0)
  		.endAngle(2 * Math.PI);

  // Recreate graph and labels
  root = formatPartition(parsedCSV, 1);               // Turn csv data array into properly formatted hierarchy for sunburst graph
  currentRoot = currentCenter = root;                 // Initializd references to root
  drawGraph();
  pathLevel = [];
  createInfoLabels(root);
}




//=========================================================================================
// Reformats the CSV into new hierarchy
//=========================================================================================
// Called when sort type changes
function refreshGraph(sortList) {
  currentSortType = eval(sortList.value)
  root = formatPartition(parsedCSV);            // Turn csv data array into properly formatted hierarchy for sunburst graph
  currentRoot = currentCenter = root;           // Initialize references to root
  createInfoLabels(root);                       // Creates elements to display relevant info about current node
  drawGraph();                                  // Inital draw paths for node blocks
}

// Called if a filter is selected
function filterGraph(filterList) {
  var newCSV = parsedCSV;
  currentFilterType = filterList.value;
  root = formatPartition(newCSV); 
  currentRoot = currentCenter = root;
  drawGraph();  
  createInfoLabels(root);                                   
  d3.select('#trail').select('g').select('text')[0][0].innerHTML = root.name; 
}


//=========================================================================================
// Formats csv to be used in partition, with
// d3.nest() and some restructuring of the tree
// in order to maintain good comprehension of visualization 
//=========================================================================================
function formatPartition(data) {
  // If a filter has been applied, remove unrelevant items
  if (currentFilterType != 'none')
    data = data.filter(function(i){ return i.degree_topic.trim() == currentFilterType; })

  // Nest function - changes based on sort / filter types
  var root = nestSelector(data, currentSortType, currentFilterType!='none');
  renameKeys(root);                   // Rename object keys/values generated from d3.nest() to name/children
  if (currentFilterType != 'none')
    root.name = 'All ' + currentFilterType;
  sumChildrenDownLoads(root);         // Recursively calculate the sum of downloads for each node
  groupByDownloads(root);             // Group children if there are too many for a clean graph
  countTheses(root);                  // Recursively count the number of theses for each node

  // Formating info for partition
  partition = d3.layout.partition()
    .sort(function(a, b) { return d3.descending(a.arcSize, b.arcSize); })
    .size([2 * Math.PI, radius]);

  // Define some of the parameters of each node object
  partition
    .value(function(d) { return d.arcSize; })
    .nodes(root)
    .forEach(function(d) {
      d._children = d.children;     // Some functions use _children 
      d.key = key(d);               // Create key for node
      d.trueDepth = d.depth;        // TrueDepth wont change based on zoom, unlike depth
      d.fill = fill(d);             // Assign the node a color 
    });

  // Redefine the value function to use the previously-computed sum.
  partition
    .children(function(d, depth) { return depth < 2 ? d._children : null; })

  // Update Root Name
  if (currentFilterType != 'none') root.name = currentFilterType;

  return root;
}


//=========================================================================================
// Set of functions to change how d3.nest() creates the tree hierarchy
// The order will change based on user selection between 3 options
//=========================================================================================
function nestSelector(data, index, filter) {
  switch(index) {
    case 1: return nestLevel_Name_Year(data);
    case 2: return nestLevel_Year_Name(data);
    case 3: return nestYear_Level_Name(data);
  }

  // Sort Degree_Level > Degree_Name > Year
  function nestLevel_Name_Year(data) {
    return { "key": "All Theses", "values": d3.nest()
      .key(function(d) { return d.degree_type; })
      .key(function(d) { return d.degree_field; })
      .key(function(d) { return d.year; })
      .key(function(d) { return d.title; })
      .entries(data) };
  }
  // Sort Degree_Level > Year > Degree_Name
  function nestLevel_Year_Name(data) {
    return { "key": "All Theses", "values": d3.nest()
      .key(function(d) { return d.degree_type; })
      .key(function(d) { return d.year; })
      .key(function(d) { return d.degree_field; })
      .key(function(d) { return d.title; })
      .entries(data) };
  }
  // Sort Year > Degree_Level > Degree_Name
  function nestYear_Level_Name(data) {
      return { "key": "All Theses", "values": d3.nest()
      .key(function(d) { return d.year; })
      .key(function(d) { return d.degree_type; })
      .key(function(d) { return d.degree_field; })
      .key(function(d) { return d.title; })
      .entries(data) };
  }
}


//=========================================================================================
// Rename the keys created by d3.nest() into more descriptive names
//=========================================================================================
function renameKeys(d) {
  d.name = d.key.trim(); delete d.key;
  if (d.values[0].hasOwnProperty("author")) { //Leaf node, keep version of the article in original format
    d.size = eval(d.values[0]["downloads"]);
    d.original = d.values[0];
  }
  else {
    d.children = d.values;
    for (i in d.children) 
      renameKeys(d.children[i]);
  }
  delete d.values;
}

//=========================================================================================
// Creates the key for nodes by concatenating path into string
// Key is used to determine which directoin animations go
//=========================================================================================
function key(d) {
  var k = [], p = d;
  while (p.depth) k.push(p.x), p = p.parent;
  return k.reverse().join(".");
}

//=========================================================================================
// Calculate color for nodes based on parent nodes when relevant
//=========================================================================================
function fill(d) {
  if (d.trueDepth <= 1) { 
    var fill_info = d3.hcl(hue(d.name));
    fill_info.c  *= 1.5;
    fill_info.l  *= .75;
  } 
  else { 
    var colorAdjust = d3.scale.linear().domain([0,d.parent.children.length]).range([-20,25]);
    var fill_info   = d3.hcl(d.parent.fill);
    fill_info.l    *= 1.09;
    fill_info.h    += colorAdjust(d.parent.children.indexOf(d));
  } 
  return fill_info;
}

//=========================================================================================
// Calculate download counts for each node in the tree recursively
//=========================================================================================
function sumChildrenDownLoads(node) {
  if (node.hasOwnProperty("children")) {
    var sum = 0;
    for (i in node.children) 
      sum += sumChildrenDownLoads(node.children[i]);  
    node.downloads = node.arcSize = sum;
    return sum;
  } 
  else {
    node.downloads = node.size;
    node.arcSize = node.size;
    return node.downloads;
  }
}

//=========================================================================================
// Calculate theses counts for each node in the tree recursively
//=========================================================================================
function countTheses(node) { 
  if (node.hasOwnProperty("children")) {
    var sum = 0;
    for (i in node.children) 
      sum += countTheses(node.children[i]);  
    node.thesesCount = sum;
    return sum;
  } 
  else return 1;
}

//=========================================================================================
// If a node has more than 10 children, keep first 9 as is, 
// Put rest in an 'Other' block as a child of that node
// If already an 'Other' block, break up children into chunks of 16 or less
//=========================================================================================
function groupByDownloads(root) {
  // Make sure 'root' is an object and has children
  if ((typeof root === 'object') && (root !== null) && (root.hasOwnProperty("children"))) {

    // Node has more than 10 chilren and is not already an 'Other' block
    if ((root.children.length > 10) && (root.name.indexOf('Other') == -1)) {
      
      // /Create 'Other' object node to hold the excess nodes
      var other = {};
      other.name = "Other " + root.name;
      
      // Split children, keep first 9 in root and put the rest into Other
      root.children.sort(function(a,b) { return b.downloads - a.downloads });
      other.children = root.children.slice(9);
      root.children  = root.children.slice(0,9);

      // Find and set total number of downloads in Others
      var otherDownloadCount = 0;
      for (i in other.children) 
        otherDownloadCount += other.children[i].downloads; 
      other.downloads = otherDownloadCount;

      // Set other's arcSize to be the same size of 9th child of root - this keeps it as smallest/last node when displayed
      // Remainder is the amount of arcSize removed from 'Other' and needs to be distributed to other 9 blocks, proportionally
      other.arcSize = root.children[8].downloads;
      var remainder = otherDownloadCount - other.arcSize;

      // Reduce the arcsize of other's children as well,
      for (i in other.children) 
        other.children[i].arcSize *= other.arcSize/root.downloads;

      // Add the remainder (i.e. sumDownloads(other.children) - other.arcSize) to the first 9 children of root
      // This keeps arc size ratios more consistent with download count
      for (i = 0; i < 9; i++) 
        root.children[i].arcSize += Math.round(remainder * (root.children[i].downloads/(root.downloads - otherDownloadCount))); 

      // Make Other a child of the current node
      root.children.push(other);
    } 
    // Node has more than 20 children and is an 'Other' block
    // Puts the many children of an 'Other' block into more managable chunks of size 16 or less
    else if ((root.name.indexOf('Other') != -1) && (root.children.length > 20)) {
        groupOthers(root);    //Uncomment to have nodes in an 'Other' node grouped into several groups
    }

    // Recursively group downloads in child nodes
    for (i in root.children)
      groupByDownloads(root.children[i]);
  }


  // Groups nodes that are already children of an 'Other' block
  function groupOthers(root) {
    var childCount   = root.children.length
    var numSubBlocks = Math.ceil(childCount/16);
    var subBlocks    = [];
    var rootArcSize  = root.arcSize;

    for (i = 0; i < numSubBlocks; i++) {
      var temp  = {};
      temp.name = root.name + " Group " + (i+1);

      // Extract last 16 of root
      temp.children = root.children.slice(0,16);
      root.children = root.children.slice(16);

      // Sum downloads and arc sizes
      var tempDownloadCount = 0, tempArcSize = 0;
      for (child in temp.children) {
        tempDownloadCount += temp.children[child].downloads; 
        tempArcSize       += temp.children[child].arcSize;
      }
      temp.downloads = tempDownloadCount;
      temp.arcSize   = Math.round(rootArcSize/numSubBlocks);

      // Gives children equal sized arcSize
      for (child in temp.children)
        temp.children[child].arcSize = Math.round(temp.arcSize/temp.children.length);

      // Add group to array
      subBlocks.push(temp);
    }
    // Replace root's children with and grouped version
    root.children = subBlocks;
  }
}

//=========================================================================================
// Populates filter list with degree_fields
// Nest will only keep articles of that degree name
// That degree becomes root, followed by year
// Maybe add secondary option to check if user wants only a particular degree level
//=========================================================================================

// Adds filters dropdown menu
function populateFilterList(filterItems) {
  var filterMenu = document.getElementById("FilterMenu");
  for (i in filterItems) {
    var option   = document.createElement('option');
    option.text  = filterItems[i];
    option.value = filterItems[i];
    filterMenu.add(option, 0);
  }
}

// Gets the degree topics from the parsed csv
function getAllDegreeTopics(data) {
  var list = [];
  for (i in data)
    list.push(cleanText(data[i].degree_topic));

  return uniqueListItems(list).sort();


  // Remove Duplicate Degree Names
  function uniqueListItems(array) {
    var seen = {};
    return array.filter(function(item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
  }  
}
                 
// Cleans the text and makes it more uniform                  
function cleanText(string) {
  return string.trim();
}


//=========================================================================================
// Given a node in a partition layout, return an array of all of its ancestor
// nodes, highest first, but excluding the root.
//=========================================================================================
function getAncestors(n) {
  var path = [];
  var current = n;
  while (current.parent) {
    path.unshift(current);
    current = current.parent;
  }
  return path;
}



//=========================================================================================
// Interpolate the arcs in data space
//=========================================================================================
function arcTween(b) {
  var i = d3.interpolate(this._current, b);
  this._current = i(0);
  return function(t) { return arc(i(t)); };
}




//=========================================================================================
// Update arc properties / coordinates
//=========================================================================================
function updateArc(d) { 
  return { depth: d.depth, x: d.x, dx: d.dx }; 
}






//=========================================================================================
// Controls how graph zooms in and out
//=========================================================================================
function zoomIn(p) {
  // Lock the breadcrumb if zoomed all the way in to an article
  if (p.hasOwnProperty('original') && (p.depth == 1)) 
    freezeBreadCrumb = true;

  if (p.depth > 1) p = p.parent;
  if (!p.children) {          // Update breadcrumb and re-freeze
    updateBreadcrumbs(getAncestors(p));
    return; 
  } 
  zoom(p, p);
}


function zoomOut(p) {
  freezeBreadCrumb = false;
  d3.selectAll('tspan').remove();
  if (!p.parent) return;
  zoom(p.parent, p);
}

//=========================================================================================
// Handles zooming functionality
//=========================================================================================
function zoom(root, p) {
  if (document.documentElement.__transition__) return;
  
  currentCenter = root;    //Update reference to node in the cener

  // Rescale outside angles to match the new layout.
  var enterArc,
      exitArc,
      outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI]);

  // Used to calculate coordinates of the inner arc of a block
  function insideArc(d) {
    return p.key > d.key
        ? {depth: d.depth - 1, x: 0, dx: 0} : p.key < d.key
        ? {depth: d.depth - 1, x: 2 * Math.PI, dx: 0}
        : {depth: 0, x: 0, dx: 2 * Math.PI};
  }

  // Used to calculate coordinataes of the outer arc of a block
  function outsideArc(d) {
  	    return {depth: d.depth+1, x: outsideAngle(d.x), dx: outsideAngle(d.x + d.dx) - outsideAngle(d.x)};
  }

  center.datum(root);

  // When zooming in, arcs enter from the outside and exit to the inside.
  // Entering outside arcs start from the old layout.
  if (root === p) enterArc = outsideArc, exitArc = insideArc, outsideAngle.range([p.x, p.x + p.dx]);

  path = path.data(partition.nodes(root).slice(1), function(d) { return d.key; });

  // When zooming out, arcs enter from the inside and exit to the outside.
  // Exiting outside arcs transition to the new layout.
  if (root !== p) enterArc = insideArc, exitArc = outsideArc, outsideAngle.range([p.x, p.x + p.dx]);


  // Draw new paths and remove old ones
  d3.transition().duration(750).each(function() {
    path.exit().transition()
        .style('fill-opacity', function(d) { return (d.depth === 1 + (root === p)) ? 1 : 0; })
        .attrTween('d', function(d) { return arcTween.call(this, exitArc(d)); })
        .remove();
    
    path.enter().append('path')
        .style('fill-opacity', function(d) { return d.depth === 2 - (root === p) ? 1 : 0; })
        .style('fill',   function(d) { return d.fill; })
        .on('mouseover', function(d) { return nodeMouseOver(d); } )
        .on('mouseout',  function(d) { return nodeMouseOut(d); })
        .on('click', zoomIn)
        .each(function(d) { this._current = enterArc(d); });

    path.transition()
        .style('fill-opacity', 1)
        .attrTween('d', function(d) { return arcTween.call(this, updateArc(d)); });
  });


  // Remove and redraw border arc to keep it at front
  d3.select('#borderArc').remove();
  svg.append('path')
	   .attr('id', 'borderArc')
	   .style('fill', 'white')
	   .attr('d', borderArc);

  // Remove old labels
  d3.selectAll('#nodeLabel').remove(); 

  // Draw new labels
  svg.selectAll("#nodeLabel").data(partition.nodes(root).slice(1))
  .enter().append('text')
    .attr('id', 'nodeLabel')
    .attr('transform', function(d) { return 'rotate(' + computeTextRotation(d) + ')'; })
    .attr('x', function(d, i) {
      if (d.hasOwnProperty('original')) d.y = radius/3 * d.depth;
      if (computeTextRotation(d)+90 < 180) return d.y + 10*(radius/340);
      else return -d.y -10*(radius/340); })
    .attr('font-size', 11*(radius/340))
    .attr('fill', 'white')
    .attr('fill-opacity', 0)
    .transition().delay(600)
    .attr('fill-opacity', function(d) { return (d.dx*45) > 4 ? 1 : 0;}).duration(500)
    .attr('text-anchor', function(d){ 
      if (computeTextRotation(d)+90 < 180) return 'start';
      else return 'end'; })
    .attr('alignment-baseline', 'middle')
    .attr('pointer-events', 'none')
    .text(function(d) { return cleanText(d.name).substring(0,17); });

  // Update center info and breadcrumbs
  nodeMouseOut(root); 
}

//=========================================================================================
// Define the behavior of the page based on hover over blocks
//=========================================================================================

// Define behavior of elements based on mouseover
function nodeMouseOver(n) {
  // Get path to root
  var ancestorList = getAncestors(n);

  // Dim all but path to current node
  svg.selectAll('path')
      .filter(function(n) { return !((ancestorList.indexOf(n) >= 0) || (n != d3.select('borderArc'))); })
      .style('opacity', .75);

  // Provide info about current node
  var i = 4, level = 'n';
  for (; i > n.trueDepth; i--) pathLevel[i-1].text('');
  for (; i > 0; i--) {
    pathLevel[i-1].text(eval(level+'.name').substring(0,20));
    level += '.parent';
  }

  // Give thesis and download count
  pathLevel[5].text(n.downloads +' Downloads');
  if (!n.hasOwnProperty('original'))              // If Is not an individual article give thesesCount
    pathLevel[6].text(n.thesesCount +' Theses');
  else pathLevel[6].text('')

  // Update breadcrumb path info to current node if an article was not clicked
  if (!freezeBreadCrumb)
    updateBreadcrumbs(ancestorList);    
}

// Define behavior of elements based on mouseout
function nodeMouseOut(n) {
  ancestorList = getAncestors(n);

  // Restore opacity
  d3.selectAll("path")
    .style("opacity", 1);

  // Get ancestors of current node - i.e root to current
  ancestorList = ancestorList.splice(0, ancestorList.length - (n.depth));

  for (i = 0; i < 5; i++) pathLevel[i].text('');
  for (i = 0; i < ancestorList.length; i++) 
    pathLevel[i].text(ancestorList[i].name.substring(0,20));

  // Update center info to be that of te current center
  if ((n.trueDepth == n.depth) && (n.trueDepth<= 2))
    pathLevel[0].text(currentRoot.name);

  // Give download and theses counts
  pathLevel[5].text(eval(currentCenter.downloads)+' Downloads');
  pathLevel[6].text(eval(currentCenter.thesesCount)+' Theses');

  // Update breadcrumb path info to current node if an article was not clicked
  if (!freezeBreadCrumb)
    updateBreadcrumbs(ancestorList);
}


//=========================================================================================
// Creates elements to display relevant info about current node
//=========================================================================================
function createInfoLabels(root) {

  // Create text nodes to provide contextual information in
  for (i = 0; i < 7; i++) {
    pathLevel.push(svg.append("text")
        .attr("x", 0)
        .attr("y",5+ (20*i)*(1.2*radius/340)-60*(1.2*radius/340))
        .attr("font-size", 17*(radius/340))
        .attr("text-anchor", "middle")
        .style("fill", "gray"));
  }

  // Write root info in center
  pathLevel[0].text(root.name);
  pathLevel[5].text(root.downloads+' Downloads');
  pathLevel[6].text(root.thesesCount+' Theses');

  // Draw clickable center svg to zoom out
  center = svg.append('circle')
      .attr('r', radius / 3)
      .attr('fill', 'white')
      .attr('fill-opacity', 0)
      .on('click', zoomOut);
}


//=========================================================================================
// Inital draw paths for node blocks or after sort / filter change
//=========================================================================================
function drawGraph() {
  // Remove previous graph if it exists
  path = svg.selectAll('path').remove();          
  svg.selectAll('path').style('fill-opacity', .1);
  path = svg.selectAll('path')
      .data(partition.nodes(currentRoot).slice(1))
    .enter().append('path')
      .attr('d', arc)
      .style('fill',   function(d){ return d.fill; })
      .on('mouseover', function(d){ return nodeMouseOver(d); } )
      .on('mouseout',  function(d){ return nodeMouseOut(d); })
      .each(function(d) { this._current = updateArc(d); })
      .on('click', zoomIn);

  // Remove any previous labels
  svg.selectAll("#nodeLabel").remove();

  // Draw new labels
  svg.selectAll("#nodeLabel")
    .data(partition.nodes(root).slice(1)).enter().append('text')
      .attr('id', 'nodeLabel')
      .attr('transform', function(d) { return 'rotate(' + computeTextRotation(d) + ')'; })
      .attr('x', function(d,i) {
        if (d.hasOwnProperty('original')) d.y = radius/3 * d.depth;
        if (computeTextRotation(d)+90 < 180) return d.y + 10*(radius/340);
        else return -d.y -10*(radius/340); })
      .attr('font-size', 11*(radius/340))
      .attr('fill', 'white')
      .attr('fill-opacity', 0)
      .transition()
        .attr('fill-opacity', function(d) { return (d.dx*45) > 4 ? 1 : 0;}).duration(500)
      .attr('text-anchor', function(d){ 
        if (computeTextRotation(d)+90 < 180) return 'start';
        else return 'end'; })
      .attr('alignment-baseline', 'middle')
      .attr('pointer-events', 'none')
      .text(function(d) { return cleanText(d.name).substring(0,17); });


  // Redraw border to keep at front
  d3.select('#borderArc').remove();
  svg.append('path')
	.attr('id', 'borderArc')
	.style('fill', 'white')
	.attr('d', borderArc);


}

// Computes location of text on circle and prevents upsidedown labels
function computeTextRotation(d) {
  var outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI]);
  var temp = (outsideAngle(d.x)+outsideAngle(d.dx)/2)*360-90;
  if (temp+90 < 180) return temp; 
  else return temp+180;             // Add 180 so that text appears right side up
  return temp;
}


//=========================================================================================
// Shows breadcrumb path to current node
// Based on Sequences Sunburst block by Kerry Rodden
// Found http://bl.ocks.org/kerryrodden/7090426
//=========================================================================================

// Adds svg for thesis link
function initializeBreadcrumbTrail() {
  // Add the svg area for the breadcrumbs
  d3.select('#trail').append('svg:text')
    .attr('id', 'thesisLink')
    .style('fill', '#000');
}

// Generate a string that describes the points of a breadcrumb polygon.
function breadcrumbPoints(d, i) {
  var points = [];
  points.push('0,0');
  points.push(b.w + ',0');
  points.push(b.w + b.t + ',' + (b.h / 2));
  points.push(b.w + ',' + b.h);
  points.push('0,' + b.h);
  if (i > 0)  // Leftmost breadcrumb; don't include 6th vertex.
    points.push(b.t + ',' + (b.h / 2));
  return points.join(' ');
}

// Update the breadcrumb trail to show the current sequence and percentage.
function updateBreadcrumbs(pathArray) {
  // Add current root to front as it is skipped in pathArray
  pathArray.unshift(currentRoot);

  // Data join; key function combines name and depth (= position in sequence).
  var g = d3.select('#trail')
      .selectAll('g')
      .data(pathArray, function(d) { return d.name + d.depth; });

  // Add breadcrumb and label for entering nodes.
  var entering = g.enter().append('svg:g');

  // Draw node path boxes
  entering.append('svg:polygon')
      .style('fill', function(d) { return d.fill; })
      .attr('points', breadcrumbPoints);


  // Draw node path text
  entering.append('svg:text')
      .attr('x', (b.w + b.t) / 2)
      .attr('y', b.h / 2)
      .attr('dy', '0.35em')
      .attr('font-size', 12)
      .attr('fill', 'white')
      .attr('text-anchor', 'middle')
      .text(function(d) { return cleanText(d.name).substring(0,19); });


  // Set position for entering and updating nodes
  g.attr('transform', function(d, i) { return 'translate(' + i * (b.w + b.s) + ', 0)'; });

  // Remove old breadcrumbs
  g.exit().remove();
  
  // If node being hovered over is an individual thesis, provide name with hyperlink to thesis
  if (pathArray[pathArray.length-1].hasOwnProperty('original')) 
    var link = pathArray[pathArray.length-1].original.url;
  else var link = "";

  // Now move and update the link at the end.
  d3.select("#trail").select("#thesisLink")
    .attr("x", (pathArray.length + 0.5) * (b.w + b.s) - 50)
    .attr("y", b.h / 2)
    .attr("dy", "0.35em")
    .style('fill', 'blue')
    .style('text-decoration', 'underline')
    .attr("text-anchor", "start")
    .on('click', function(){ window.open(link, '_blank'); })
    .text(function(){ if (pathArray.length > 0) {
        var node = pathArray[pathArray.length-1];
        if (node.hasOwnProperty('original')) // Is an individual article
          return (node.original.title.length > 45) ? 
            node.original.title.substring(0,42) + '...' : node.original.title;
      } 
      else return '';
    });
  
}



//=========================================================================================
// Allow user to download csv from current root
//=========================================================================================
function downloadCsv() {
  if (!promptContinue()) return;

  // Creates csv text from array of thesis objects
  var csvContent = convertToCSVText(grabOriginals(currentCenter, []));

  var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || safari.pushNotification);

  // Better download implementation is not yet available on Safari
  // So check the browswer and provide an alternate solution if necessary
  if (isSafari){
    // Works on Chrome and Firefox, Safari as Unknown file, not on Explorer or Edge
    var a = document.body.appendChild(document.createElement("a"));
    a.download  = "export.csv";
    a.href      = "data:octet-stream/csv;charset=utf-8," + encodeURI(csvContent);
    a.target    = "_blank"
    a.innerHTML = "download csv";
    a.click();
    document.body.removeChild(a);
  }
  else {
    // Works on most major browswer except Safari (it will support this in version 10.1)
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, 'export.csv');
    } 
    else {
      var link = document.createElement("a");
      if (link.download !== undefined) { // feature detection
          // Browsers that support HTML5 download attribute
          var url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute("download", 'export.csv');
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
    }
  }


  // Prompt if usser would like to continue to download csv
  // Provides a short description of what data is included
  // *Note: If browser asks if it should prevent alerts from the page,
  //        CSV may no longer work until page is refreshed
  function promptContinue() {
    var text = "You are about to download a csv of '";

    ancestorList = getAncestors(currentCenter);

    if (currentFilterType == 'none') text += 'All Theses';
    else text += currentFilterType;

    for (i in ancestorList) text += ", " + ancestorList[i].name;
    text += "' Continue?"

    return confirm(text);
  }


  // Get original format of theses from leaf nodes
  function grabOriginals(node, items) {
    if (node.hasOwnProperty("original")) 
      items.push(node.original);
    else 
      for (i in node._children) 
        grabOriginals(node._children[i], items);
    return items;
  }

  // Creates csv formatted text from array of thesis objects
  function convertToCSVText(items) {
    if (items.length < 1) return '';
    csvContent = getHeader(items[0]);

    for (i in items) {
      var line = '';
      for (var index in items[i]) {
        items[i][index] = items[i][index].replace(/[\r\n]+/g," ");
        if (items[i][index].indexOf && (items[i][index].indexOf(',') !== -1 || items[i][index].indexOf('"') !== -1)) {
          items[i][index] = '"' + items[i][index].replace(/"/g, '""') + '"';
        }
        if (line != '') line += ','
        line += items[i][index];
      }
      csvContent += line + '\r\n';
    }
    return csvContent;
  }

  // Creates a csv header based upon keys of a thesis item
  function getHeader(example) {
    return Object.keys(example).toString() + '\r\n';
  }

}

