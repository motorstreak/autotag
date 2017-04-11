## Motivation
I was looking for a simple and lighweight Javascript or JQuery plugin to automatically color hashtags on the fly. There are a lot of solutions out there - from full fledged Rich Text editors to simple jQuery plugins. Rich Text editors were an overkill while the simpler and smaller ones added additional dom elements and CSS to the mix. 

## How does jquery-autotag work?
jquery-hash sets the contenteditable attribute to true on the dom element, allowing you to edit the text within it. On every kestroke, the input text is analyzed and broken into substrings based on some word seperators (comma, period and space). Each substring is then wrapped within span elements and styles added as required. 

## Usage
The code is structured as a jQuery plugin. However, there is very little jQuery dependancy in the code. If you know Javascript, you can easily morph the code into a pure JS library. 

Include jQuery and the plugin on your page along with your other jQuery and javascript plugins.

```html
<head>
   <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js"></script>
   <script src="jquery-autotag-1.3.js" type="text/javascript"></script> 
</head>
```

Set the attribute 'contenteditable' to true on the element you wish to use for input.

```html
<div id="snippet" contenteditable="true"></div>
```

Activate the plugin on the element you wish to use for capturing user input.

```javascript
$(document).ready(function() {
    $("snippet").autotag();
 });
```

Still not sure? Take a look at the code in demo folder.


## Disclaimer
I am not a Javascript developer. Chances are, there are bugs and other stuff that experienced Javascript developers may find objectionable. If you are one of them, feel free to contribute patches. If you find this useful and would like to build something better based on it, please go ahead!
