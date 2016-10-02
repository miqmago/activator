/*jslint node:true, nomen:true, unused:vars */
var _ = require('lodash'), async = require('async'), mailparser = require('./mailparser'), DRIVER = require('./filesdriver'), templatesDriver = DRIVER(), mails, shouldUseStyliner = false, Styliner = require('styliner');

styliner = new Styliner('./');

// keep a cache of mails
mails = {};


// Recursive function
function getMail(type, part, list, currIdx, cb) {
    var decideWhatToDo = function (err, result) {
        if (err && currIdx === list.length - 1) {
            cb(err);
        } else if (!result && currIdx === list.length - 1) {
            cb(null, {
                subject: '',
                content: '',
            });
        } else if (result) {
            cb(null, mailparser(type, part, result, list[currIdx], mails));
        } else {
            // Look for next language in list
            getMail(type, part, list, currIdx + 1, cb);
        }
    };
    var promise = templatesDriver(type + '_' + part, list[currIdx], decideWhatToDo);

    if (typeof promise.then === 'function') {
        promise.then(function (result) {
            decideWhatToDo(null, result);
        }, function (err) {
            decideWhatToDo(err, '');
        });
    }
}

module.exports = {
	init : function (driver, styliner) {
		templatesDriver = driver || DRIVER();
		// reset mails
		mails = {};
		shouldUseStyliner = styliner || false;
	},
	get : function (type,lang,callback) {
		// build our list from most specific to least-specific
		var now = new Date().getTime(), found = false, list = _.reduce(
				(lang||"").split('_'),
				function(result,item){
					result.push(  result.length === 0 ? item : [].concat(result[result.length-1],item).join("_") ); 
					return(result);},
				[]).reverse();
		// default case
		list.push("");
		
		// need to get the mail from templates driver if not cached already
		// however, we must be careful of the fallback
		// e.g. we once sent an email with no matching lang, e.g. he_IL, so the default (item="") was found and cached
		// now we look for a different lang, e.g. fr_FR. Since we never looked for it, we will not have it in the cache,
		//   but we *will* have the default (item=""), which would cause us not to look for fr_FR on the templates driver
		// so it is important that we check not only "is it in the cache", but "did we ever look for it"
		// our logic is:
		// 1- go from most-specific (fr_FR) to less specific (fr) to default ("")
		// 2- with each one, if it is cached use it
		// 3- if it is not cached but also was not found on the templates driver, go to the next
		// essentially, we need a system to track which ones we searched for and when
		mails[type] = mails[type] || {};
		// look for each type in reverse order
		_.each(list,function (item) {
			// first, if it is not found at all, then we never searched for it, so go back
			if (!mails[type][item]) {
				found = false;
				return(false);
			} else if (!mails[type][item].notfound && mails[type][item].expired > now) {
				// so we searched for it. if it was found and is not expired, used it
				found = mails[type][item];
				return(false);
			}
			// else either it is expired, or it was notfound, so keep looking for the next less-specific down the line
		});
		// did we find an answer?
		if (found) {
			callback(null,found);
        } else {
            // This will ask to the templates driver each mail key: type + part ('_text' or '_html')
            // It will recursively look for every language until it finds a valid text
            // or there no more languages to look for. In that case it will return an empty text
            var fetchers = [
                function (cb) {
                    getMail(type, 'text', list, 0, cb);
                },
                function (cb) {
                    getMail(type, 'html', list, 0, cb);
                }];

            async.parallel(fetchers, function (err, results) {
                // there should be no errors, we should just be complete
                _.each(list, function (item) {
                    if (mails[type][item] && mails[type][item].expired > now) {
                        found = mails[type][item];
                        return(false);
                    }
                });
                // did we find an answer?
                callback(null, found);
            });
		}
	},
	compile: function (type,lang,config,callback) {
		this.get(type,lang,function (err,res) {
			if (err) {
				callback(err);
			} else if (!res) {
				callback(null,null);
			} else {
				// we have the saved mail template - it might be html or text
				if(shouldUseStyliner && res.html) {
					styliner.processHTML(res.html.content(config)).then(function(processedSource) {
						callback((res.text||res.html).subject(config), res.text?res.text.content(config):null, processedSource);
					});
				} else {
					callback((res.text||res.html).subject(config),res.text?res.text.content(config):null,res.html?res.html.content(config):null);
				}

			}
		});
	}
};