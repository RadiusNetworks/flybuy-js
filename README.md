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

First, instantiate a new `Flybuy` object. After you have done that, you can call `flybuy.createMap` once you have the data you wish to load. The first argument to the method should the selector string. (not a DOM element)

```
let flybuy = new Flybuy();

window.addEventListener('DOMContentLoaded', () => {
  let jsonFile = 'sample_data/initial_orders_api.json';

  fetch(jsonFile).then(response => response.json()).then(data => {
    flybuy.createMap('div#map', data);
  });
});
```

_Note: The DOM must be loaded before you attempt to create the map. The example uses the `DOMContentLoaded` event, but you could also move the `<script>` tag after the body._

## Updating a map

If you want to update a map after it has been drawn, you can call `flybuy.update`:
```
let jsonFile = 'sample_data/orders_api_update.json';

fetch(jsonFile).then(response => response.json()).then(data => {
  flybuy.update(data);
});
```

## Features not implemented yet

* The `update` method will move existing markers but it will not remove markers from the map
* The `update` method can accept new polygons for pickup areas and premises, but it will not draw them yet
