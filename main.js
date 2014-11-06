/*
 * Copyright (c) 2014 Konstantin Kobs
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true */
/*global define, brackets, $, window */

define(function (require, exports, module) {
    "use strict";

    var AppInit             = brackets.getModule("utils/AppInit"),
        CodeHintManager     = brackets.getModule("editor/CodeHintManager"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        LanguageManager     = brackets.getModule("language/LanguageManager");
    
    /**
     * @constructor
     */
    function SASSHint() {
        
        // Some settings especially for LESS
        this.implicitChar = "$";
        this.regex = /\$([\w\-]+)\s*:\s*([^\n;]+)/ig;
        this.chars = /[\$\w\-]/i;
        
        // Array with hints and the visual list in HTML
        this.hints = [];
        this.hintsHTML = [];
        
        // String which was written since the hinter is active
        this.writtenSinceStart = "";
        
        // Startposition of cursor
        this.startPos = null;
        
    }

    /**
     * Checks if it is possible to give hints.
     * 
     * @param   {Object}  editor       The editor object
     * @param   {String}  implicitChar The written character
     * @returns {Boolean} whether it is possible to give hints
     */
    SASSHint.prototype.hasHints = function (editor, implicitChar) {
        
        // The editor instance
        this.editor = editor;
        
        // Set the start position for calculating the written text later
        this.startPos = editor.getCursorPos();
        
        // Check if the written character is the trigger
        return implicitChar ? implicitChar === this.implicitChar : false;
        
    };
    
    /**
     * Gets the hints in case there are any
     * 
     * @param   {String} implicitChar The last written character
     * @returns {Object} The list of hints like brackets wants it
     */
    SASSHint.prototype.getHints = function(implicitChar) {
        
        // We don't want to give hints if the cursor is out of range
        if(!this.validPosition(implicitChar)) return null;
        
        // Get the text in the file
        var text = this.getText();
        
        // Get all matches for the RegExp set earlier
        var matches = this.getAll(this.regex, text);
        
        // Filter the results by everything the user wrote before
        matches = this.filterHints(matches);
        
        // Prepare the hint arrays
        this.processHints(matches);
        
        return {
            hints: this.hintsHTML,
            match: null,
            selectInitial: true,
            handleWideResults: false
        };

    };
    
    /**
     * Inserts a chosen hint into the document
     * 
     * @param {String} hint the chosen hint
     */
    SASSHint.prototype.insertHint = function (hint) {
        
        // We showed the HTML array. Now we need the clean hint.
        // Get index from list
        var index = this.hintsHTML.indexOf(hint);
        // Get hint from index
        hint = this.hints[index];
        
        // Document instance
        var document = DocumentManager.getCurrentDocument();
        
        // Endpoint to replace
        var pos = this.editor.getCursorPos();
        
        // Add text in our document
        document.replaceRange(hint, this.startPos, pos);
        
    };
    
    /**
     * Checks if it still is possible to give hints.
     * It is not possible to give hints anymore if:
     * - the cursor is before the position of the starting position
     * - the user typed some character which is not usable in a variable name
     * 
     * @param   {String}  implicitChar The last written character
     * @returns {Boolean} True, if the cursor has a valid position
     */
    SASSHint.prototype.validPosition = function(implicitChar){
        
        // If the written char is not in a valid
        // set of characters for a variable.
        if(implicitChar && !this.chars.test(implicitChar)){
            return false;
        }
        
        // Document instance
        var document = DocumentManager.getCurrentDocument();
        // Current cursor position
        var cursorPos = this.editor.getCursorPos();
        
        // If we navigate inside of the range with the cursor
        // then we can save the part that was written until now
        // Else the cursor is out of range and we don't want to give
        // hints anymore.
        if(cursorPos.line == this.startPos.line &&
           cursorPos.ch >= this.startPos.ch){
            this.writtenSinceStart = document.getRange(this.startPos, cursorPos);
        } else{
            return false;
        }
        
        // If nothing applied until now, we want to pass
        return true;
        
    };
    
    /**
     * Gets the text of the current document.
     * 
     * @returns {String} Text of the current document
     */
    SASSHint.prototype.getText = function() {
        
        // Get text from editor
        return this.editor.document.getText();
        
    };
    
    /**
     * Returns all matches of the RegExp in the text
     * @param   {RegExp} regex The RegExp which should be used
     * @param   {String} text  The searchable string
     * @returns {Array}  All matches of the RegExp in the string
     */
    SASSHint.prototype.getAll = function(regex, text){
        
        // We start empty
        var matches = [];
        
        // For every match
        var match;
        while ((match = regex.exec(text)) !== null) {
            
            // Push it to the array
            matches.push(match);
            
        }
        
        // Return the match array
        return matches;
        
    };
    
    /**
     * Filters the list of hints by the already written part
     * 
     * @param   {Array} matches Array of matches
     * @returns {Array} the filtered Array
     */
    SASSHint.prototype.filterHints = function(matches){

        // Split it up/convert to array for fuzzy search
        var written = this.writtenSinceStart.toLowerCase().split("");
        
        // Filter the matches array
        matches = matches.filter(function(match){
            
            // Get the hint
            var hint = match[1].toLowerCase();
            
            // Check if every character of the written string
            // is in the right order in the hint
            for(var i = 0; i < written.length; i++){
                
                var index = hint.indexOf(written[i]);
                
                if(index === -1){
                    return false;
                } else{
                    hint = hint.substr(index + 1);
                }
            }
            
            return true;
        });
        
        // Return the filtered array
        return matches;

    };
    
    /**
     * Processes all the matches and prepares the hints and hintsHTML arrays
     * 
     * @param   {Array}    matches All the matches (already filtered)
     */
    SASSHint.prototype.processHints = function(matches){
        
        // Sort all filtered matches alphabetically
        matches = matches.sort(function(match1, match2){
            
            var var1 = match1[1].toLowerCase();
            var var2 = match2[1].toLowerCase();
            
            if(var1 > var2){
                return 1;
            } else if(var1 < var2){
                return -1;
            } else{
                return 0;
            }
            
        });
        
        // Put every hint for insertion in the hints array
        this.hints = matches.map(function(match){
            return match[1];
        });
        
        // Create the hintsHTML array which will be shown to the
        // user. It has a preview of what the variable is set to.
        this.hintsHTML = matches.map(function(match){
            return match[1] + "<span style='color:#a0a0a0; margin-left: 10px'>" + match[2] + "</span>";
        });
        
    };
    
    /**
     * Register the HintProvider
     */
    AppInit.appReady(function () {
        var sassHints = new SASSHint();
        CodeHintManager.registerHintProvider(sassHints, ["sass", "scss"], 0);
    });
});
