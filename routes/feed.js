var express = require('express');
var https = require('https');
var mcache = require('memory-cache');
var xml2js = require('xml2js');
var router = express.Router();
const parser = new xml2js.Parser();

router.get('/', function(req, res, next) {

    // check cache
    let key = '__express__' + req.originalUrl || req.url;
    let cachedBody = mcache.get(key);

    var url = req.query.url;
    var filter = req.query.filter || '';

    if (!url) {
        res.status(400).send({error: 'Podcast URL not provided'});
        return;
    }

    if (cachedBody) {
        // console.log(`Cache hit: ${cachedBody}`);
        res.set('Content-Type', 'text/xml');
        res.send(cachedBody);
    } else {
        https.get(url, (resp) => {
            const { statusCode } = resp;    
            if (statusCode !== 200) {
                res.status(500).send({error: 'Podcast feed failed to load'});
                return;
            }
            let data = '';
            resp.on('data', function(stream) {
                data += stream;
            });
            resp.on('end', function(){
                parser.parseString(data, function(error, result) {
                    if(error === null && result !== null) {
                        // console.log(result);
                        // console.log(result.rss.channel);

                        let indicesToRemove = [];
                        result.rss.channel[0].item.forEach((element, index) => {
                            if (!element.title[0].includes(filter)) {
                                indicesToRemove.push(index)
                            }
                        });
                        // indicesToRemove.sort()
                        indicesToRemove.reverse()
                        indicesToRemove.forEach(indexToRemove => {
                            result.rss.channel[0].item.splice(indexToRemove, 1)
                        });

                        var builder = new xml2js.Builder();
                        var xml = builder.buildObject(result);
                        res.set('Content-Type', 'text/xml');
                        var cacheTime = 10 * 60 * 1000; // 10 minutes
                        mcache.put(key, xml, cacheTime);
                        res.send(xml);
                    }
                    else {
                        console.log(error);
                        res.status(500).send({error: 'Failed to parse RSS'});
                    }
                    
                });
            });
        }).on("error", (e) => {
            res.status(500).send({error: 'HTTPS request failed'});
        });
    }
});

module.exports = router;
