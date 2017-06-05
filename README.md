## Demo
You can see a working demo [here](https://s3-us-west-1.amazonaws.com/jquery-autotag/index.html).


## Motivation
I was looking for a simple and lightweight Javascript or JQuery plugin to color hashtags on the fly. There are a lot of solutions out there - from full fledged Rich Text editors to simple jQuery plugins, not to mention numerous code snippets. The text editors were an overkill (not to mention their size) while the smaller, lighter plugin and code snippets were hacky and/or not cross-browser compatible.  
  
So, I wrote autotag.js with the following objectives in mind  

1. Do only as much is possible in 10Kb.  
2. Use words as formatting boundaries.
3. Use plain Javascript. 
4. Make it extensible, only if #1 allows for it.

If you find this plugin useful and use it as is or in some modified form, dont forget to pass on some credit. It was really hard getting this to work. Seriously!

## How does Autotag.js work?
Autotag.js sets the 'contenteditable' attribute to true, allowing you to edit text within it. On every keystroke, the input text is analyzed and broken into chunks based on some logic (in the splitter function). Each chunk of string is then wrapped within a 'Tag' element to which css styling can be added as required. 

You can 

## Usage
If you are familiar with Javascript, you can easily modify the code to suite your needs. If you don't, take a look at the code in the demo directory.

Set the attribute 'contenteditable' to true on the element you wish to use for input.

```html
<div id="snippet" contenteditable="true"></div>
```

Activate the plugin on the element you wish to use for capturing user input.

```javascript
/* The editor area */
var notepad = document.getElementById('notepad');

/* A menubar for the editor */
var menubar = document.getElementById('menubar');

/* Make the editor autotag capable and attach the menubar */ 
new Autotag(notepad, demo_config).attachMenubar(menubar);

```

Still not sure? Take a look at the code in demo folder or see it in [action](https://s3-us-west-1.amazonaws.com/jquery-autotag/index.html).

## Browser Compatibility
Works on Chrome 57, Safari 10.1, Firefox 52.02, IE 11.0 and Edge. 
As for other browsers or their versions, I am hoping it will work fine (except for IE8 and below - for which I have no hope whatsoever!).

Having said that, I do not guarantee that this will continue to work on IE and/or Edge. In the past few months, I spent an inordinate amount of time trying to make this work smoothly in IE. I am no longer interested in spending my time on a browser that tends to do things differently from the specs.

## Disclaimer
I am not a Javascript developer (I have written code for many years, if that is of any consolation). Chances are, there are bugs and other stuff that experienced Javascript developers may find objectionable. If you are one of them, feel free to contribute patches. 

If you find this useful and would like to build something better based on it, please go ahead!
