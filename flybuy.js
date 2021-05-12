class Flybuy {

  constructor() {
    this.map = null;
    this.provider = null;
    this.markers = [];
    this._pickupAreasFeatureIds = [];
    this._premisesFeatureId = null
    this._premisesSourceId = null;
    this._premisesLayerId = null;
    this._pickupAreasSourceId = null;
    this._pickupAreasLayerIds = [];
    this._premisesFeatureBounds = null;
  }

  // PUBLIC METHODS

  createMap(containerSelector, payloadData, showControls=false) {
    return new Promise((resolve, reject) => {

      // Try to determine which map provider (Google, Mapbox, etc.) is being used
      this.provider = this._determineMapProvider();

      if (!this.provider) {
        throw new Error('Could not determine map provider.');
      }

      // Make sure the access token is provided if needed
      if (!this._checkAccessToken(this.provider)) {
        throw new Error('Access token for provider not found. Aborting.');
      }

      // Find the DOM element where the map should be drawn
      let containerElement = this._findContainerElement(containerSelector);

      if (!containerElement) {
        throw new Error('Container element for map selector not found. Aborting.');
      }

      // Attempt to draw the map for the provider
      this.map = this._initMapForProvider(this.provider, containerElement, payloadData.data, showControls)
        .then(map => {
          this.map = map;
          this._drawPremises(payloadData.data);
          this._drawPickupAreas(payloadData.data);
          this._updateOrders(payloadData.data);
          this._styleMap();
          resolve(true);
        })
        .catch(error => {
          console.error(error);
          reject(false);
        });
    });
  }

  removeMap() {
    if (this.provider === 'google') {
      this.map = null;
    }
    else if (this.provider === 'mapbox') {
      this.map.remove();
    }
  }

  removeMarker(markerId) {
    let markerIndex = this.markers.findIndex(marker => marker.orderId === markerId);
    if (markerIndex === -1) return false;

    if (this.provider === 'google') {
      this.markers[markerIndex].marker.setMap(null);
      this.markers.splice(markerIndex, 1);
    }
    else if (this.provider === 'mapbox') {
      this.markers[markerIndex].marker.remove();
      this.markers.splice(markerIndex, 1);
    }
    else {
      console.log('removingMarker for provider is not yet supported');
    }
  }

  update(payloadData) {
    this._updateOrders(payloadData.data);


    if (payloadData.data.site) {
      this._drawPremises(payloadData.data);
      this._drawPickupAreas(payloadData.data);
      this._styleMap();
    }
  }

  // PRIVATE METHODS

  _updateOrders(payloadData) {
    if (!this.map) {
      throw new Error('You must call createMap before attempting to call _updateOrders.');
    }

    let orders = [];

    // Data came from a webhook
    if (payloadData && payloadData.data && payloadData.data.type === 'order') {
      orders = [payloadData.orders]; // make an array of one object
    }
    // Data came from orders API
    else if (payloadData && payloadData.orders && Array.isArray(payloadData.orders)) {
      orders = payloadData.orders;
    }

    orders.forEach(order => {
      let markerObj = this._findMarkerByOrderId(order.id);

      // Create a new marker if we don't have one for this order
      if (!markerObj) {
        let newMarker = this._createMarker(order.customer_latitude, order.customer_longitude, this.map);
        this.markers.push({'orderId': order.id, 'marker': newMarker});
      }
      // Update the marker if we already have one
      else {
        this._moveMarker(markerObj.marker, order.customer_latitude, order.customer_longitude);
      }
    });

    // Center the map on the bounds of all the markers
    this._centerMap();
  }

  _findContainerElement(containerSelector) {
    let element = containerSelector;

    // If it's a string, assume it's a selector and not an element
    if (typeof(containerSelector) === 'string') {
      element = document.querySelector(containerSelector);
    }

    // Make sure the element exists in the visible DOM
    let elementExists = document.body.contains(element);

    if (!elementExists) {
      throw new Error(`Unable to find DOM element for selector: "${containerSelector}"`);
    }
    else {
      return element;
    }
  }

  _initMapForProvider(provider, containerElement, data, showControls) {
    return new Promise((resolve, reject) => {
      let lat = 0.0;
      let lng = 0.0;

      // Attempt to determine the center point from the data
      if (data.site && data.site.location.lat && data.site.location.lng) {
        lat = parseFloat(data.site.location.lat);
        lng = parseFloat(data.site.location.lng);
      }

      if (provider === 'google') {
        let centerPoint = new google.maps.LatLng(lat,lng);
        let map = new google.maps.Map(containerElement, {disableDefaultUI: !showControls});

        let bounds = new google.maps.LatLngBounds();
        bounds.extend(centerPoint);
        map.fitBounds(bounds);

        resolve(map);
      }
      else if (provider === 'mapbox') {
        let map = new mapboxgl.Map({
          container: containerElement,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [lng, lat],
          zoom: 17
        });

        let bounds = new mapboxgl.LngLatBounds([lng,lat], [lng,lat]);
        map.fitBounds(bounds);

        if (showControls === true) {
          map.addControl(new mapboxgl.NavigationControl());
        }

        map.on('load', () => {
          resolve(map);
        });
      }
      else {
        reject('Could not create map for provider');
        return;
      }
    });
  }

  // If the provider requres a key or token, make sure it's been provided
  _checkAccessToken(provider) {
    if (provider === 'mapbox') {
      return (mapboxgl.accessToken !== undefined && mapboxgl.accessToken !== null);
    }
    else {
      return true;
    }
  }

  // Looks for window variables to determine which map library has been used
  _determineMapProvider() {
    if (typeof(google) === 'object') {
      return 'google';
    }
    else if (typeof(mapboxgl) === 'object') {
      return 'mapbox';
    }
    else {
      return null;
    }
  }

  // Draw the premises polygon on the map (if it exists)
  _drawPremises(data) {
    if (!this.map) {
      throw new Error('You must call createMap before attempting to call _drawPremises.');
    }

    // Attempt to find the premises polygon from the data provided
    if (data.site && data.site.premises_coordinates) {
      let premisesFeature = data.site.premises_coordinates;

      if (this.provider === 'google') {
        this._clearGoogleFeature(premisesFeature.id);
        let premisesGeoJson = {'type': 'FeatureCollection', 'features': [premisesFeature]};
        this.map.data.addGeoJson(premisesGeoJson);
        this._premisesFeatureId = premisesFeature.id;
        this._centerMap();
      }
      else if (this.provider === 'mapbox') {
        this._clearMapboxFeature(this._premisesSourceId, [this._premisesLayerId]);
        this._premisesFeatureBounds = this._computePolygonBoundingBox(premisesFeature);
        this._premisesSourceId = 'premises-source';
        this._premisesLayerId = 'premises-layer';

        this.map.addSource('premises-source', {
          'type': 'geojson',
          'data': premisesFeature
        });

        this.map.addLayer({
          'id': 'premises-layer',
          'type': 'line',
          'source': 'premises-source',
          'paint': {
            'line-color': '#FFCC00',
            'line-width': 3
          }
        });
      }
      else {
        console.error('Adding premises for provider not yet supported');
      }
    }
    else {
      console.warn('Could not find premises feature in the data provided');
    }
  }

  // Create a Mapbox LngLatBounds for a GeoJSON feature
  _mapboxBoundsForFeature(feature) {
    let bounds = new mapboxgl.LngLatBounds();

    feature.geometry.coordinates.forEach(coordinates => {
      bounds.extend(coordinates);
    });

    return bounds;
  }

  // Attempt to remove the feature if it exists on the Google map already
  _clearGoogleFeature(featureId) {
    let existingFeature = this.map.data.getFeatureById(featureId);
    if (!existingFeature) return;
    this.map.data.remove(existingFeature);
  }

  _clearMapboxFeature(sourceId, layerIds) {
    if (sourceId && layerIds) {
      layerIds.map(layerId => this.map.removeLayer(layerId));
      this.map.removeSource(sourceId);
    }
  }

  // Centers the map based on the features that have been added
  _centerMap() {
    if (!this.map) {
      throw new Error('You must call createMap before you attempt to call _centerMap');
    }

    if (this.provider === 'google') {
      let bounds = new google.maps.LatLngBounds();

      this.markers.forEach(markerObj => {
        bounds.extend(markerObj.marker.position);
      });

      this.map.data.forEach(feature => {
        if (feature.getGeometry().getType() === 'Polygon') {
          feature.getGeometry().forEachLatLng(function(latlng) {
            bounds.extend(latlng);
          });
        }
      });

      this.map.fitBounds(bounds, {padding: 30, duration: 0});
    }
    else if (this.provider === 'mapbox') {
      let bounds = new mapboxgl.LngLatBounds();

      this.markers.forEach(markerObj => {
        bounds.extend(markerObj.marker.getLngLat());
      });

      bounds.extend(this._premisesFeatureBounds);
      this.map.fitBounds(bounds, {padding: 50});
    }
    else {
      throw new Error('centering map is not yet supported for this provider');
    }
  }

  // Draw the pickup areas polygons on the map (if they exist)
  _drawPickupAreas(data) {
    if (!this.map) {
      throw new Error('You must call createMap before attempting to call _drawPickupAreas.');
    }

     // Attempt to find the pickup areas polygons from the data provided
     if (data.site && data.site.pickup_areas) {
      let pickupAreasFeatures = data.site.pickup_areas;

      if (!Array.isArray(pickupAreasFeatures)) {
        console.error('The pickup_areas property must be an array of geojson features.');
        return;
      }
      else if (pickupAreasFeatures.length === 0) {
        console.error('Error! Pickup areas array was blank. Cannot draw polygons.');
        return;
      }

      const pickupAreasJson = {'type': 'FeatureCollection', 'features': pickupAreasFeatures};

      if (this.provider === 'google') {
        pickupAreasFeatures.forEach(feature => this._clearGoogleFeature(feature.id));
        this.map.data.addGeoJson(pickupAreasJson);
        this._pickupAreasFeatureIds = pickupAreasFeatures.map(area => area.id);
      }
      else if (this.provider === 'mapbox') {
        this._clearMapboxFeature(this._pickupAreasSourceId, this._pickupAreasLayerIds);

        let sourceId = 'source-pickup-areas';
        let sourceFeatures = {'type': 'geojson', 'data': pickupAreasJson};
        this.map.addSource(sourceId, sourceFeatures);
        this._pickupAreasSourceId = sourceId;
        this._pickupAreasLayerIds = ['pickup-areas-fill-layer', 'pickup-areas-stroke-layer'];

        this.map.addLayer({
          'id': 'pickup-areas-fill-layer',
          'type': 'fill',
          'source': sourceId,
          'paint': {
            'fill-color': '#FFCC00',
            'fill-opacity': 0.25,
          }
        });

        this.map.addLayer({
          'id': 'pickup-areas-stroke-layer',
          'type': 'line',
          'source': sourceId,
          'paint': {
            'line-color': '#FFCC00',
            'line-width': 3
          }
        });
      }
      else {
        console.error('Adding pickup zones for provider not yet supported');
      }
    }
  }

  _styleMap() {
    if (!this.map) {
      throw new Error('You must call createMap before you atttempt to call _styleMap');
    }

    if (this.provider === 'google') {
      this.map.data.setStyle(feature => {
        // Style the premises feature
        if (feature.getId() === this._premisesFeatureId) {
          return {
            strokeColor: '#FFCC00',
            strokeWeight: 3,
            fillOpacity: 0
          }
        }
        // Style the pickup areas
        else if (this._pickupAreasFeatureIds.includes(feature.getId())) {
          return {
            fillColor: '#FFCC00',
            fillOpacity: 0.25,
            strokeColor: '#FFCC00',
            strokeOpacity: 0.5,
            strokeWeight: 5
          }
        }
      });
    }
    else if (this.provider === 'mapbox') {
      // We don't need to do anything for mapbox
      return;
    }
    else {
      throw new Error('_styleMap is not supported for this provider');
    }
  }

  _createMarker(latitude, longitude, map) {
    let lat = parseFloat(latitude);
    let lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('Latitude or longitude not a valid float');
    }

    if (this.provider === 'google') {
      let position = {lat, lng};
      let marker = new google.maps.Marker({map: map, position: position, draggable: false});
      return marker;
    }
    else if (this.provider === 'mapbox') {
      let marker = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(this.map);
      return marker;
    }
    else {
      throw new Error('Creating marker for provider not yet supported');
    }
  }

  _findMarkerByOrderId(orderId) {
    return this.markers.find(record => record.orderId === orderId);
  }

  _moveMarker(marker, latitude, longitude) {
    let lat = parseFloat(latitude);
    let lng = parseFloat(longitude);

    if (this.provider === 'google') {
      let latLng = new google.maps.LatLng(lat,lng);
      marker.setPosition(latLng);
    }
    else {
      marker.setLngLat([lng,lat]);
    }
  }

  _oldcomputePolygonBoundingBox(data) {
    var bounds = {}, coordinates, latitude, longitude;

    for (let i=0; i < data.features.length; i++) {
      coordinates = data.features[i].geometry.coordinates;

      if (coordinates.length === 1) {
        for (var j = 0; j < coordinates[0].length; j++) {
          longitude = coordinates[0][j][0];
          latitude  = coordinates[0][j][1];

          // Update the bounds recursively by comparing the current xMin/xMax and yMin/yMax with the current coord
          bounds.xMin = bounds.xMin < longitude ? bounds.xMin : longitude;
          bounds.xMax = bounds.xMax > longitude ? bounds.xMax : longitude;
          bounds.yMin = bounds.yMin < latitude ? bounds.yMin : latitude;
          bounds.yMax = bounds.yMax > latitude ? bounds.yMax : latitude;
        }
      }
    }

    return [[bounds.xMin, bounds.yMin], [bounds.xMax, bounds.yMax]];
  }

  _computePolygonBoundingBox(feature) {
    let bounds = {};
    let coordinates = feature.geometry.coordinates;

    for (let i=0; i < coordinates[0].length; i++) {
      let longitude = coordinates[0][i][0];
      let latitude  = coordinates[0][i][1];

        // Update the bounds recursively by comparing the current xMin/xMax and yMin/yMax with the current coord
        bounds.xMin = bounds.xMin < longitude ? bounds.xMin : longitude;
        bounds.xMax = bounds.xMax > longitude ? bounds.xMax : longitude;
        bounds.yMin = bounds.yMin < latitude ? bounds.yMin : latitude;
        bounds.yMax = bounds.yMax > latitude ? bounds.yMax : latitude;
    }

    return [[bounds.xMin, bounds.yMin], [bounds.xMax, bounds.yMax]];
  }
}
