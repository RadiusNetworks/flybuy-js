# Flybuy Javascript SDK

The Flybuy JS SDK allows partners to draw a map with markers for orders and polygons for premises and pickup areas.

## Supported Map Providers

Currently, the SDK only supports Google Maps. (Mapbox will be added in the future)

To use Google Maps, you *must* include the Google Maps JS SDK in your HTML before you include the Flybuy JS:
```
<script src="https://maps.googleapis.com/maps/api/js?key=<GOOGLE MAPS API KEY"></script>
<script src="flybuy.js"></script>
```

_Note: The Flybuy JS SDK will automatically determine that you want to use Google Maps if you have included the Google Maps Javascript._

## Creating a map

First, instantiate a new `Flybuy` object. After you have done that, you can call `flybuy.createMap` once you have the data you wish to load. The first argument to the method should the selector string or a DOM element.

The instantiated `Flybuy` object does not need to be global in scope, you may assign it to whatever context works for your application.

```
let flybuy = new Flybuy();

window.addEventListener('DOMContentLoaded', () => {
  let jsonFile = 'sample_data/initial_orders_api.json';

  fetch(jsonFile).then(response => response.json()).then(data => {
    flybuy.createMap('div#map', data);
  });
});
```

If you wish to pass a HTML element to `createMap`, you can do so:

```
let container = document.querySelector('div#map');
flybuy.createMap(container, data);
```

_Note: The DOM must be loaded before you attempt to create the map. The example uses the `DOMContentLoaded` event, but you could also move the `<script>` tag after the body._

## Completion handler hook when creating maps

If you need a completion handler hook when creating a map, `createMap` returns a Promise:
```
flybuy.createMap(container, data)
  .then(success => {})
  .catch(success => {})
});
```

## Updating a map

If you want to update a map after it has been drawn, you can call `flybuy.update`:
```
let jsonFile = 'sample_data/orders_api_update.json';

fetch(jsonFile).then(response => response.json()).then(data => {
  flybuy.update(data);
});
```

## Removing a map

If you are using a reactive framework (such as React or Vue), you should call `removeMap` when your component is destroyed. **Failure to do so can result in WebGL errors.**

## Removing a marker

If you want to remove a marker from a map, you can call `flybuy.removeMarker` and pass it that marker's `id` property:
```
let markerIdToRemove = 13;

flybuy.removeMarker(markerIdToRemove);
```

## Example implementations

See the sample [Google Maps](google.html) and [Mapbox](mapbox.html) implementations.
