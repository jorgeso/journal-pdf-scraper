import * as https from 'https';
import { JSDOM } from 'jsdom';
import { IncomingMessage, RequestOptions } from 'http';
import { URL } from 'url';
import * as fs from 'fs';
import * as throttledQueue from 'throttled-queue';

function processRequest(pubmedId: string, url: string, cookie?: string): void {

    const urlObject = new URL(url);
    const requestOptions: RequestOptions = {
        host: urlObject.host,
        path: urlObject.pathname + urlObject.search,
        headers: {
            'Cookie': cookie || ''
        }
    }

    https.get(requestOptions, (resp: IncomingMessage) => {
        if (resp.statusCode === 200) {

            if (resp.headers["content-type"].indexOf('text/html') > -1) {
                let data = '';

                // A chunk of data has been recieved.
                resp.on('data', (chunk) => {
                    data += chunk;
                });

                // The whole response has been received. Print out the result.
                resp.on('end', () => {
                    try {
                        console.log(pubmedId);
                        const dom = new JSDOM(data);
                        const portlet = dom.window.document.querySelector('.portlet');
                        if (portlet != null) {
                            const anchor = portlet.querySelector('a');
                            if (anchor != null) {
                                fs.appendFile('./data/publication_links.txt', `\n${pubmedId}\t${anchor.href}`, (err) => {});
                            }
                        }
                    } catch (e) {
                        console.log(e);
                    }
                });
            }
        }
    });
}

fs.readFile('./data/_pubmedids.txt', 'utf8', (err, data) => {
    if (err) {
        throw err;
    }
    const pubmedIds = data.split('\n');

    var throttle = throttledQueue(1, 1000);

    pubmedIds.forEach(pubmedId => {
        throttle(() => {
            processRequest(pubmedId, `https://www.ncbi.nlm.nih.gov/pubmed/${pubmedId}`)
        });
    });
});