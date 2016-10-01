var fs = require('fs'), _ = require('lodash'), mailparser = require('./mailparser'), PATH = './lang/mail', path;

function filesDriver(key, lang, callback) {
    var keyParts = key.split('_');
    var part = keyParts.pop();
    var type = keyParts.join('_');
    var list = [];
    list.push(lang);
    list.push('');

    fs.readdir(path,function (err,files) {
        var actuals = [];
        if (err) {
            callback("missingmailfiles");
        } else {
            _.each(list,function (item) {
                var fileName = type+(item?'_'+item:''), txtName = fileName + '.txt', htmlName = fileName + '.html';
                if (_.includes(files,fileName) && part === 'text') {
                    actuals.push({name:item,type:"text",path:path+'/'+fileName});
                } else if (_.includes(files,txtName) && part === 'text') {
                    actuals.push({name:item,type:"text",path:path+'/'+txtName});
                }
                if (_.includes(files,htmlName) && part === 'html') {
                    actuals.push({name:item,type:"html",path:path+'/'+htmlName});
                }
            });
            // actuals now contains the actual file names we have
            if (actuals.length) {
                async.each(actuals,
                    function(item,cb) {
                        fs.readFile(item.path,'utf8',function (err,data) {
                            mailparser(type, item.type, data, item.name, mails);
                            cb();
                        });
                    },
                    function (err) {
                        // there should be no errors, we should just be complete
                        _.each(list,function (item) {
                            if (mails[type][item] && mails[type][item].expired > now) {
                                found = mails[type][item];
                                return(false);
                            }
                        });
                        // did we find an answer?
                        callback(null,found);
                    }
                );
            } else {
                callback(null,{
                    subject: '',
                    content: '',
                });
            }
        }
    });
}

module.exports = function (path) {
    path = p || PATH;
    return filesDriver;
};