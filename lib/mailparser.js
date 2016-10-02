var EXPIRY = 60;
 
module.exports = function (type, part, text, lang, cache) {
    cache = cache || {};
    cache[type] = cache[type] || {};
    cache[type][lang] = cache[type][lang] || {};
    cache[type][lang].expired = new Date().getTime() + EXPIRY*60*1000;
    if (text) {
        text = text.replace(/\r\n/g,'\n');
        text = text.match(/^([^\n]*)\n[^\n]*\n((.|\n)*)/m);
        cache[type][lang][part] = {
            subject: _.template(text[1]),
            content: _.template(text[2]),
        };
    } else {
        cache[type][lang][part] = {
            notfound: true,
        };
    }
    return cache[type][lang][part];
};
