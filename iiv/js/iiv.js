// Change

var iiv = {};
// added for popup - sfb
var polygonLayer;
var map;
// end of add sfb



iiv.Class = function(prototype) {
    var c = function(options) {
      jQuery.extend(this, options);
      this.initialize.apply(this);
    };

    c.prototype = prototype;
    return c;
};


iiv.Viewer = new iiv.Class({
  ui: null,
  iivContainer: '.iiv',
  mapContainer: 'iiv-image-panel',
  fedoraUrl: 'http://' + location.host + '/fedora',
  pids: null,
  pageIndex: 0,
  map: null,

  initialize: function(options) {
    this.ui = new iiv.Viewer.UI({viewer: this});
    this.riSearch = new iiv.Viewer.RISearch(this.riSearchOptions());
    this.riSearch.search();
    jQuery.iiv = this;
  },

  intercept: function(object, method, interceptor) {
    object[method + '_without_interceptor'] = object[method];
    object[method] = interceptor;
  },

  riSearchOptions: function() {
    var viewer = this;
    return {
      pid: this.pid,
      cmodel: this.cmodel,
      dsid: this.dsid,
      fedoraUrl: this.fedoraUrl,
      uid: this.uid,
      searchCallback: this.createSearchCallback()
    };
  },

  createSearchCallback: function() {
    var viewer = this;

    return function(results) {
      viewer.pids = results;
      for (i = 0; i < viewer.pids.length; i++) {
        if (viewer.pids[i] == viewer.pid) {
          viewer.pageIndex = i;
          break;
        }
      }

      viewer.loadText();
      viewer.initializeMap();
      viewer.ui.initializeUI();
      
      if(solr_search_term.length > 0){
         //call search for highlight terms
        getHighlightCoordinates(viewer.currentPid(), solr_search_term);
      }
    };
  },

  initializeMap: function() {
    OpenLayers.Layer.OpenURL.viewerWidth = jQuery('.iiv-canvas').width();
    OpenLayers.Layer.OpenURL.viewerHeight = jQuery('.iiv-canvas').height();
    var imageLayer = this.createImageLayer();

    var mapOptions = this.createMapOptions(imageLayer);
    mapOptions.controls = this.createMapControls();
    this.map = new OpenLayers.Map(this.mapContainer, mapOptions);
    this.map.addLayer(imageLayer);

    var lon = this.map.maxExtent.width / 2;
    var lat = this.map.maxExtent.height / 2;
    this.map.setCenter(new OpenLayers.LonLat(lon, lat), 0);
 
    //added by sfb
    // polygon control for use with popup boxes
    map = this.map; 
     //polyControl is used for selections and eventually annotations
    polyControl = new OpenLayers.Control(this.map);

    OpenLayers.Util.extend(polyControl, {
      draw: function() {
         this.box = new OpenLayers.Handler.RegularPolygon(polyControl,
              {"done": this.notice}, {sides:4, irregular:true, persist:true});
           this.box.activate();
        },//draw
        notice: function(geom) {
            boxNotice(geom);
	    }//notice
    });//OpenLayers.Util.extend
    //end add by sfb  
    polygonLayer = new OpenLayers.Layer.Vector("Annotations");
    
    //added by sfb --use for debugging
    //map.addControl(new OpenLayers.Control.LayerSwitcher());
    //map.addControl(new OpenLayers.Control.MousePosition());
    //sabina 
    mulpolyControl = new OpenLayers.Control(this.map);
    vectors = new OpenLayers.Layer.Vector("Polygon Layer");
   // map.addLayers([imageLayer, vectors]);
    //sfb fixed
    map.addLayers([polygonLayer, vectors]);
    
    OpenLayers.Util.extend(mulpolyControl, {
       draw: function() {       	 
         this.poly = new OpenLayers.Handler.Polygon(mulpolyControl,
         {"done": this.notice}, {sides:7, irregular:true, persist:true});
         this.poly.activate();            
      },//gives user the control to draw polygon     
      
       notice: function(geom) {           
           boxNotice(geom);     
        }//notice
    });//OpenLayers.Util.extend
    
 },    
    createMapControls: function() {
    var controls = [
                    //added sfb
        new OpenLayers.Control.Navigation({documentDrag: true}),
        new OpenLayers.Control.MouseDefaults(),
        new OpenLayers.Control.KeyboardDefaults()
       ];

    return controls;
  },

  createMapOptions: function(imageLayer) {
    var metadata = imageLayer.getImageMetadata();
    var resolutions = imageLayer.getResolutions();
    var maxExtent = new OpenLayers.Bounds(0, 0, metadata.width, metadata.height);
    var tileSize = imageLayer.getTileSize();
    var options = {resolutions: resolutions, maxExtent: maxExtent, tileSize: tileSize};
    return options;
  },

  createImageLayer: function() {
    var pid = this.currentPid();
    var djatokaUrl = this.djatokaUrl(pid);

    var imageLayer = new iiv.Viewer.ImageLayer('OpenURL', '', {
          isBaseLayer : true,
          layername : 'basic',
          format : 'image/jpeg',
          rft_id :  this.rftUrl(pid),
          metadataUrl : djatokaUrl + '/getMetadata?uid=' + this.uid
        });

    imageLayer.djatokaUrl = djatokaUrl;
    imageLayer.uid = this.uid;




    return imageLayer;
  },

  rftUrl: function(pid) {
    return this.djatokaUrl(pid) + '/JP2?uid=djatoka';
  },

  currentPid: function() {
    return this.pids[this.pageIndex];
  },

  djatokaUrl: function(pid) {
    return this.pidUrl(pid) + '/ilives:jp2Sdef';
  },

  pidUrl: function(pid) {
    return this.fedoraUrl + '/get/' + pid;
  },

  textUrlIsHtml: function(url) {
    return /tei2html/.test(url);
  },

  textUrl: function(pid) {
    switch(this.cmodel) {
      case 'ilives:bookCModel':
      case 'ilives:pageCModel':
      case 'ilives:slideCModel':
        dsid = '/ilives:tei2htmlSdef/tei2html';
        break;
      case 'newspapers:issueCModel':
      case 'newspapers:pageCModel':
        dsid = 'OCR';
        break;
      case 'islandora-dm:po-document-cmodel':
      default:
        dsid = 'text';
        break;
    }

    return this.fedoraUrl + '/get/' + pid + '/' + dsid + '?uid=' + this.uid;
  },


  setPage: function(index) {
    if (index != this.pageIndex && index >= 0 && index < this.pids.length) {
      this.pageIndex = index;
      this.loadText();

      var nextLayer = this.createImageLayer();
      var options = this.createMapOptions(nextLayer);
      this.map.resolutions = options.resolutions;
      this.map.maxExtent = options.maxExtent;
      this.map.tileSize = options.tileSize;

      var baseLayer = this.map.baseLayer;
      this.map.addLayer(nextLayer);

      this.map.setBaseLayer(nextLayer);
      this.map.removeLayer(baseLayer);
      this.ui.updatePageControls(index);
    }
  },

  //move forward/backwards in page numbers - MR
  nextPid: function() {
    clearHighlightLayer();
    clearAnnotationLayer();
	clearSelectBox();
    this.setPage(this.pageIndex + 1);
  },

  previousPid: function() {
    clearHighlightLayer();
    clearAnnotationLayer();
	clearSelectBox();
    this.setPage(this.pageIndex - 1);
  },

  loadText: function() {
    var container = this.ui.textContainer;
    container.html('');

    url = this.textUrl(this.currentPid());
    html = this.textUrlIsHtml(url);

    if (html) {
      jQuery.get(url, function(data) {
        container.html(data);
      }, 'html');
    }
    else {
      jQuery.get(url, function(data) {
        container.html('<pre>' + data + '</pre>');
      }, 'html');
    }
  },

  printUrl: function () {
    if (this.cmodel == 'newspapers:issueCModel') {
      url = this.fedoraUrl + '/get/' + this.currentPid() + '/PagePDF?uid=' + this.uid;
    }
    else if (this.cmodel == 'islandora-dm:po-document-cmodel') {
      url = this.fedoraUrl + '/get/' + this.currentPid() + '/pdf?uid=' + this.uid;
    }
    else {
      url = this.djatokaPrintUrl();
    }

    return url;
  },

  djatokaPrintUrl: function() {
    var imageExtent = this.map.getMaxExtent();
    var aspect = imageExtent.getWidth() / imageExtent.getHeight();
    var scale = aspect > 1.3333 ? "600,0" : "0,800";
    var level = '3'; // TODO calculate

    // assemble url
    var imageUrl = this.djatokaUrl(this.currentPid()) + '/getRegion?uid=' + this.uid + '&level=' + level + '&scale=' + scale;
    var printUrl = '/iiv/print.html?pid=' + this.currentPid() + '&image=' + escape(imageUrl);

    return printUrl;
  } //, sfb commented out
  
  
});



// Hat Project Mark, setup the controls for the UI display
iiv.Viewer.UI = new iiv.Class({
  viewer: null,
  sliderPage: null,
  buttonPagePrevious: null,
  buttonPageNext: null,
  sliderZoom: null,
  buttonZoomIn: null,
  buttonZoomOut: null,
  buttonZoomMax: null,
  buttonText: null,
  imagePanel: null,
  textPanel: null,
  textContainer: null,
  buttonPrint: null,
  buttonMultiPolygon:null,

  buttonHighlight: null,
  buttonPolygon:null,
  SearchBar: null,
  buttonSearch: null,

  selectBar: null,
  selectBox: null,
  buttonHideAnnotation:null,
  buttonFlagAnnotation:null,
  
  initialize: function(options) {
    this.createUI();
  },

  createDiv: function(parent, cssClass) {
    var div = jQuery('<div class="' + cssClass + '"></div>');
    parent.append(div);
    return div;
  },

  createUI: function() {
    var container = jQuery(this.viewer.iivContainer);
    container.append('<link rel="stylesheet" href="/iiv/css/jquery-ui/smoothness/jquery-ui-1.7.2.custom.css" type="text/css" />');
    container.append('<link rel="stylesheet" href="/iiv/css/iiv.css" type="text/css"/>');
    container.append('<!--[if IE]><link rel="stylesheet" href="/iiv/css/ie6.css" type="text/css"><![endif]-->');

    var ui = this.createDiv(container, 'iiv-ui ui-corner-all');
    var toolbar = this.createDiv(ui, 'iiv-toolbar');
    // HAT Project Mark, Create Annotation Toolbar
    var annToolbar = this.createDiv(ui, 'iiv-annToolbar');
    
    this.createZoomControls(toolbar);
    this.createPageControls(toolbar);
    this.createOtherControls(toolbar);

    //HAT Project Pete, Create the toolbar that holds the SearchBar control, and the Search Button
    this.createSearchControls(toolbar);
    //HAT Project Mark, Create the toolbar that holds the SelectBox control, and it's assosicated buttons
    this.createSelectControls(annToolbar);
    



    var canvas = this.createDiv(ui, 'iiv-canvas'); 
    this.textPanel = this.createDiv(canvas, 'iiv-text-panel');
    this.textContainer = this.createDiv(this.textPanel, 'iiv-text-container');

    this.imagePanel = this.createDiv(canvas, 'iiv-image-panel');
    this.imagePanel.attr('id', 'iiv-image-panel');

    var clear = this.createDiv(container, 'iiv-clear');

    jQuery('.ui-state-default').hover (
        function(){
          jQuery(this).addClass("ui-state-hover");
        },
        function(){
          jQuery(this).removeClass("ui-state-hover");
        }
    );
  },

  //creat the actuall toolbars
  //createSearchControls contains createSearchBar which is Pete's search bar
  //Mark, Added a search button that will trigger a new search, for now display a MSGBox with the search text
  createZoomControls: function(toolbar) {
    var controls = this.createControlSet(toolbar, 'zoom');
    this.buttonZoomIn = this.createButton(controls, 'zoom-in', 'Zoom in', 'ui-icon-plus');
    this.buttonZoomOut = this.createButton(controls, 'zoom-out', 'Zoom out', 'ui-icon-minus');
    this.buttonZoomMax = this.createButton(controls, 'zoom-max', 'Reset zoom level', 'ui-icon-refresh');
    this.sliderZoom = this.createZoomSlider(controls, 'zoom-slider', 'Change zoom level');
    return controls;
  },

  createPageControls: function(toolbar) {
    var controls = this.createControlSet(toolbar, 'page');
    this.buttonPagePrevious = this.createButton(controls, 'page-previous', 'Previous page', 'ui-icon-arrowthick-1-w');
    this.createPageNumberDisplay(controls);
    this.buttonPageNext = this.createButton(controls, 'page-next', 'Next page', 'ui-icon-arrowthick-1-e');
    this.sliderPage = this.createPageSlider(controls, 'page-slider', 'Change page');
    return controls;
  },

  createOtherControls: function(toolbar) {
    var controls = this.createControlSet(toolbar, 'other');
    this.buttonText = this.createButton(controls, 'text', 'Show text', 'iiv-icon-text');
    this.buttonPrint = this.createButton(controls, 'print', 'Print page', 'ui-icon-print');
    //HAT Changes
    this.buttonHighlight = this.createButton(controls, 'highlight', 'Highlight Text', 'ui-icon-pencil');

    return controls;
  },

    //Pete -->
  createSearchControls: function(toolbar){
    var controls = this.createControlSet(toolbar, 'searchControlSet');
    this.SearchBar = this.createSearchBar(controls, 'text', 'Search Bar');
    //add the search button
    this.buttonSearch = this.createButton(controls, 'search', 'Search', 'ui-icon-search');
    return controls;
  },

  //Mark  -->
  createSelectControls: function(annToolbar){
    var annControls = this.createDiv(annToolbar, 'selectBar');
    
    //selectBar populated with annotations
    this.selectBar = this.createSelectBar(annControls, 'select', 'Select Box');   
    //add Hide / Show annotation button
    this.buttonHideAnnotation = this.createButton(annControls, 'buttonHideAnnotation', 'Hide Annotation', 'ui-icon-comment ');
    //add Flagging annotation button
    this.buttonFlagAnnotation = this.createButton(annControls, 'buttonFlagAnnotation', 'Flag Annotation', 'ui-icon-flag ');
    //Sabina
    this.buttonPolygon = this.createButton(annControls, 'polygon', 'Draw Rectangle', 'ui-icon-arrow-2-se-nw');
    this.buttonMultiPolygon = this.createButton(annControls, 'poly', 'Draw Polygon', 'ui-icon-comment');
	
    return annControls;
  },
  
  // Pete -->
  createSearchBar: function(parent, name, title) {
      var searchBar = jQuery('<input class="'+ name +' ui-corner-all ui-state-default" name="searchBar" ID="searchBar" type="' + name + '"  title="' + title + '"/>');
	  //var searchBar = jQuery('<input class="text" name="searchBar" id="searchBar" />');
	  parent.append(searchBar);
    return searchBar;
  },
  
  // Mark -->
  createSelectBar: function(parent, name, title) {
      var selectBox = jQuery('<select class="'+ name +' ui-corner-all ui-state-default" name="selectBox" ID="selectBox" type="' + name + '"  title="' + title + '"/>');
	  parent.append(selectBox); 
	  
    return selectBox;
  },


  createPageNumberDisplay: function(parent) {
    var container = this.createDiv(parent, 'iiv-page-number');
    this.currentPageSpan = jQuery('<span class="current">-</span>');
    this.maxPageSpan = jQuery('<span class="max">-</span>');
    container.append(this.currentPageSpan);
    container.append('<span class="separator"> / </span>');
    container.append(this.maxPageSpan);
    return container;
  },

  createControlSet: function(parent, name) {
    var controls = this.createDiv(parent, 'iiv-controlset ' + name);
    parent.append(controls);
    return controls;
  },

  createButton: function(parent, name, title, iconClass) {
    var button = jQuery('<button class="' + name + ' ui-corner-all ui-state-default"  title="' + title + '"><span class="ui-icon ' + iconClass + '"></span></button>');
    parent.append(button);
    return button;
  },

  createZoomSlider: function(parent, name, tooltip, sliderOptions) {
    var container = this.createDiv(parent, 'iiv-slider-container ui-corner-bottom');
    container.attr('title', tooltip);

    var slider = this.createDiv(container, 'iiv-slider ' + name);
    slider.slider(sliderOptions);

    parent.append(slider);
        return slider;
  },


  createPageSlider: function(parent, name, tooltip, sliderOptions) {
    var container = this.createDiv(parent, 'iiv-slider-container ui-corner-bottom');
    container.attr('title', tooltip);

    var slider = this.createDiv(container, 'iiv-slider-page ' + name);
    slider.slider(sliderOptions);

    parent.hover(
      function() {
        container.show();
        parent.height(84);
      },

      function() {
        parent.height(32);
        container.hide();
      }
    );

    return slider;
  },

  initializeUI: function() {
    this.addInterceptors();

    this.maxPageSpan.text(this.viewer.pids.length);
    this.sliderPage.slider('option', 'min', 0);
    this.sliderPage.slider('option', 'max', this.viewer.pids.length - 1);
    this.updatePageControls(this.viewer.pageIndex);

    this.sliderZoom.slider('option', 'min', 0);
    this.sliderZoom.slider('option', 'max', this.viewer.map.getNumZoomLevels() - 1);
    this.updateZoomControls(this.viewer.map.getZoom());

    this.addEventHandlers();
  },

  addInterceptors: function() {
    var ui = this;
    ui.viewer.intercept(this.viewer.map, 'setCenter', function(lonlat, zoom, dragging, forceZoomChange) {
      if (zoom != null && zoom != ui.viewer.map.getZoom()) {
        ui.updateZoomControls(zoom);
      }

      ui.viewer.map.setCenter_without_interceptor(lonlat, zoom, dragging, forceZoomChange);
    });
  },


  addEventHandlers: function() {
    var viewerUI = this;
    viewerUI.buttonZoomIn.click(function() {
      viewerUI.viewer.map.zoomIn();
    });

    viewerUI.buttonZoomOut.click(function() {
      viewerUI.viewer.map.zoomOut();
    });

    viewerUI.buttonZoomMax.click(function() {
      viewerUI.viewer.map.zoomToMaxExtent();
    });

    viewerUI.sliderZoom.bind('slidestop', function(event, ui) {
      viewerUI.viewer.map.zoomTo(ui.value);
    });

    viewerUI.buttonPagePrevious.click(function() {
      viewerUI.viewer.previousPid();
    });

    viewerUI.buttonPageNext.click(function() {
      viewerUI.viewer.nextPid();
    });

    viewerUI.sliderPage.bind('slidestop', function(event, ui) {
      viewerUI.viewer.setPage(ui.value);
    });

    viewerUI.buttonText.click(function() {
      viewerUI.toggleText();
    });

    viewerUI.buttonPrint.click(function() {
      viewerUI.printPage();
    });

    //HAT Project Mark, Highlight button pressed
    viewerUI.buttonHighlight.click(function() {
        viewerUI.highlightToggle();
      });

    //HAT Project Mark, Search button pressed
    viewerUI.buttonSearch.click(function() {
    	viewerUI.searchToggle();
      });
    //Sabina polygon button click, call polygonToggle method
      viewerUI.buttonPolygon.click(function() {
    	viewerUI.polygonToggle();
      });
    //Sabina polygon button click, call polygonToggle method
      viewerUI.buttonMultiPolygon.click(function() {
    	viewerUI.multipolygonToggle();
      });
      // Mark, fuction for Hide Annotation Button
      viewerUI.buttonHideAnnotation.click(function() {
           viewerUI.hideAnnotationToggle();
       });
      // Mark, Function for Flag annotation button
      viewerUI.buttonFlagAnnotation.click(function() {
           viewerUI.flagAnnotationToggle();
       });
      // Mark, Function for when the Select box onChange event triggers
      //not sure why I can't trigger this via the viewerUI.selectBox onchange, change, onChange, events....
      //viewerUI.selectBox.onfocus(function() {  
        jQuery('#selectBox').change(function(){
      	viewerUI.selectBoxOnChange();
     	  
       });

      //Pete, Added onkeypress function. Please note, viewerUI uses JQuery functions only!
      viewerUI.SearchBar.keyup(function(e){
          if(e.keyCode == 13) {
            viewerUI.searchToggle();
          }
      });
  },

  printPage: function() {
    var url = this.viewer.printUrl();

    // open popup window
    var popupWidth = Math.max(800, Math.min(624, window.screen.availWidth));
    var popupHeight = Math.max(600, Math.min(824 / 2, window.screen.availHeight));
    var features = 'width=' + popupWidth + ',height=' + popupHeight + ',toolbar=1';
    window.open(url, '_blank', features);
  },

  updatePageControls: function(page) {
    this.sliderPage.slider('value', page);  //added semicolon Mark
    this.currentPageSpan.text(page + 1);

    if (page == 0) {
      this.disable(this.buttonPagePrevious);
    }

    else {
      this.enable(this.buttonPagePrevious);
    }

    if (page == this.sliderPage.slider('option', 'max')) {
      this.disable(this.buttonPageNext);
    }

    else {
      this.enable(this.buttonPageNext);
    }
  },

  updateZoomControls: function(zoom) {
    this.sliderZoom.slider('value', zoom);

    if (zoom == this.sliderZoom.slider('option', 'min')) {
      this.disable(this.buttonZoomOut);
    }

    else {
      this.enable(this.buttonZoomOut);
    }

    if (zoom == this.sliderZoom.slider('option', 'max')) {
      this.disable(this.buttonZoomIn);
    }

    else {
      this.enable(this.buttonZoomIn);
    }
  },

  disable: function(button) {
    button.attr('disabled', 'disabled');
  },

  enable: function(button) {
    button.removeAttr('disabled');
  },

  toggleText: function() {
    this.buttonText.toggleClass('ui-state-active');
    this.buttonText.toggleClass('ui-state-default');
    this.imagePanel.toggleClass('narrow');
    this.textPanel.toggle();
    this.viewer.map.updateSize();
  },

  highlightToggle: function(){
  	  toggleHighlightLayer(); 	  
  },

  searchToggle: function(){
  	  var pid = this.viewer.currentPid();
  	  var query = this.viewer.ui.SearchBar[0].value;
  	  // sfb check the search status before attempting another one
  	   checkStatusAndSearch(pid,query);
   },
  //Sabina polygon Toggle
   polygonToggle: function(){
	   //added by sfb
	   setupPopControl();
   },
   //sabina
   multipolygonToggle: function(){
	    //alert("this draws the polygon");
	    setupPopControlforPolygon();
	    
   },

  // Mark Annotation Hide / Show
  hideAnnotationToggle: function(){
       //alert("Hook for annotations Hide / Show");
       queryForAnnotation(this.viewer.currentPid());

   },
   // Mark Annotations Flagging
   flagAnnotationToggle: function(){
//	  var pid = this.viewer.currentPid();
//	  var uid = drupal_uid;
//      alert("PID: " + pid);
//      alert("UID: " + uid);
	   //TODO Flag the selected annotation
      
   },
   	// Mark selectBox onChange event
   selectBoxOnChange: function(){
	   //get the index of the item that is currently selected
	   var selectedItem = jQuery('#selectBox').val();
	   
	   //alert("SelectBox Value: " + selectedItem); //test code
	   
	   //draw the annotation
       showAnnotation(selectedItem);
       
  }

});

iiv.Viewer.RISearch = new iiv.Class({
  type: 'tuples',
  lang: 'itql',
  format: 'csv',
  query: null,
  results: null,

  initialize: function(options) {
    if (!this.query) {
      if (this.cmodel == 'ilives:bookCModel') {
        this.query = 'select $object from <#ri> '
          + 'where ($object <fedora-model:hasModel> <fedora:ilives:pageCModel> '
          + 'and $object <fedora-rels-ext:isMemberOf> <fedora:' + this.pid + '>) '
          + 'order by $object';
      }
      else if (this.cmodel == 'newspapers:issueCModel') {
    	this.query = 'select $object from <#ri> where ('
          + ' $object <fedora-model:hasModel> <fedora:newspapers:pageCModel>'
          + ' and $object <info:fedora/fedora-system:def/relations-external#isPartOf> <info:fedora/'+this.pid+'>)'
          + ' order by $object';
      }
      else if (this.cmodel == 'ilives:pageCModel') {
        this.query = 'select $parent '
          + 'subquery ('
          + '  select $sibling from <#ri> '
          + '  where $sibling <fedora-rels-ext:isMemberOf> $parent '
          + '  and $sibling <fedora-model:hasModel> <fedora:ilives:pageCModel> '
          + '  order by $sibling) '
          + 'from <#ri> '
          + 'where $child <mulgara:is> <fedora:' + this.pid + '> '
          + 'and $child <fedora-rels-ext:isMemberOf> $parent '
          + 'and $parent <fedora-model:hasModel> <fedora:ilives:bookCModel>';
      }
      else if (this.cmodel == 'newspapers:pageCModel') {
          this.query = 'select $parent '
            + 'subquery ('
            + '  select $sibling from <#ri> '
            + '  where $sibling <fedora-rels-ext:isPartOf> $parent '
            + '  and $sibling <fedora-model:hasModel> <fedora:newspapers:pageCModel> '
            + '  order by $sibling) '
            + 'from <#ri> '
            + 'where $child <mulgara:is> <fedora:' + this.pid + '> '
            + 'and $child <fedora-rels-ext:isPartOf> $parent '
            + 'and $parent <fedora-model:hasModel> <fedora:newspapers:issueCModel>';
        }
      else if (this.cmodel == 'islandora:slideCModel') {
        this.query = 'select $parent '
          + 'subquery ('
          + '  select $sibling from <#ri> '
          + '  where $sibling <fedora-rels-ext:isMemberOfCollection> $parent '
          + '  and $sibling <fedora-model:hasModel> <fedora:islandora:slideCModel> '
          + '  order by $sibling) '
          + 'from <#ri> '
          + 'where $child <mulgara:is> <fedora:' + this.pid + '> '
          + 'and $child <fedora-rels-ext:isMemberOfCollection> $parent '
          + 'and $parent <fedora-model:hasModel> <fedora:islandora:collectionCModel>';
      }
      else if (this.cmodel == 'islandora-dm:po-document-cmodel') {
        this.query = 'select $object from <#ri> '
          + 'where ($object <fedora-model:hasModel> <fedora:islandora-dm:po-page-cmodel> '
          + 'and $object <fedora-rels-ext:isMemberOf> <fedora:' + this.pid + '>) '
          + 'order by $object';
      }

      else {
        // no query -- pid will be used alone.
      }
    }
  },

  search: function() {
    if (this.query == null) {
      this.results = [this.pid];
    }

    else {
      options = {
          type: this.type,
          lang: this.lang,
          format: this.format,
          query: this.query,
          uid: this.uid
      };

      jQuery.post(this.fedoraUrl + '/risearch', options, this.createCallback(), 'text');
    }
  },

  extractPid: function(riSearchResult) {
    return riSearchResult.replace(/^.*\//, '');
  },

  createCallback: function() {
    var riSearch = this;

    return function(data, status) {
      var results = [];
      if ('success' == status) {
        var lines = data.split("\n");
        for (i = 0; i < lines.length; i++) {
          if (i > 0 && lines[i] != '') {
            results.push(riSearch.extractPid(lines[i]));
          }
        }
      }

      riSearch.searchCallback(results);
    }
  }
});

/* monkey patch OpenLayers.Layer.OpenURL */
iiv.Viewer.ImageLayer = OpenLayers.Class(OpenLayers.Layer.OpenURL, {
  djatokaUrl: null,
  uid: null,

  /**
   * this implementation is the same as the superclass, except that we use a
   * fedora service as the url base, not djatoka itself
   */
  getURL: function(bounds) {
    bounds = this.adjustBounds(bounds);
    this.calculatePositionAndSize(bounds);
    var z = this.map.getZoom() + this.zoomOffset;

    // uid and djatokaUrl set in createImageLayer
    var path = this.djatokaUrl + '/getRegion?uid=' + this.uid + '&level=' + z
      + '&region=' + this.tilePos.lat + "," + this.tilePos.lon + "," + this.imageSize.h + "," + this.imageSize.w;

    var url = this.url;
    if (url instanceof Array) {
        url = this.selectUrl(path, url);
    }
    return url + path;
  }
});
// moved to iivutil.js