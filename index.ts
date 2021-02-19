import * as https from 'https';
import { JSDOM } from 'jsdom';
import { IncomingMessage, RequestOptions } from 'http';
import { URL } from 'url';
import * as fs from 'fs';
import * as throttledQueue from 'throttled-queue';

function processRequest(pubmedId: string, url: string, cookie?: string, originalUrl?: string): void {

    const urlObject = new URL(url);
    let originalUrlObject = new URL('http://null.com/');
    if (originalUrl) {
        originalUrlObject = new URL(originalUrl);
    }
    const requestOptions: RequestOptions = {
        host: urlObject.host,
        path: urlObject.pathname + urlObject.search,
        headers: {
            'Host': urlObject.host,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:66.0) Gecko/20100101 Firefox/66.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            // 'Accept-Language': 'en-US,en;q=0.5',
            // 'Accept-Encoding': 'gzip, deflate, br',
            // 'DNT': 1,
            // 'Connection': 'keep-alive',
            'Cookie': cookie || '',
            // 'Upgrade-Insecure-Requests': 1
        }
    }

    https.get(requestOptions, (resp: IncomingMessage) => {
        console.log(resp.headers["content-type"]);
        console.log(url);
        console.log(resp.statusCode);
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
                        data = data.replace(/<noscript>/g, '');
                        data = data.replace(/<\/noscript>/g, '');
                        const dom = new JSDOM(data);
                        if (querySelectors[urlObject.host] || querySelectors[originalUrlObject.host]) {
                            const querySelector = querySelectors[urlObject.host] || querySelectors[originalUrlObject.host];
                            const anchorElement = dom.window.document.querySelector(querySelector);
                            console.log(dom.window.document.querySelector('#redirect-message'));
                            if (anchorElement != null && anchorElement.href) {
                                let pdfUrl;
                                if (anchorElement.href[0] === '/') {
                                    pdfUrl = `${urlObject.protocol}//${urlObject.host}${anchorElement.href}`;
                                } else {
                                    pdfUrl = anchorElement.href;
                                }
                                processRequest(pubmedId, pdfUrl, cookie, originalUrl || url);
                            } else if (dom.window.document.querySelector('#redirectURL')) {
                                const redirectUrlInput: HTMLInputElement = dom.window.document.querySelector('#redirectURL');
                                cookie = cookie || '';
                                resp.headers["set-cookie"].forEach(_cookie => {
                                    const cookieParts = _cookie.split(';');
                                    cookie += cookieParts[0];
                                });
                                processRequest(pubmedId, decodeURIComponent(redirectUrlInput.value), cookie, originalUrl || url);
                            } else if (dom.window.document.querySelector('#redirect-message')) {
                                const redirectMessageElement: HTMLElement = dom.window.document.querySelector('#redirect-message');
                                const redirectUrlAnchor: HTMLAnchorElement = redirectMessageElement.querySelector('a');
                                cookie = cookie || '';
                                resp.headers["set-cookie"].forEach(_cookie => {
                                    const cookieParts = _cookie.split(';');
                                    cookie += cookieParts[0];
                                });
                                processRequest(pubmedId, redirectUrlAnchor.href, cookie, originalUrl || url);
                            }
                        }
                    } catch (e) {
                        console.log(e);
                    }
                });
            } else if (resp.headers["content-type"].indexOf('application/pdf') > -1) {
                let fileName = `${pubmedId}.pdf`;
                if (resp.headers["content-disposition"]) {
                    resp.headers["content-disposition"].split(';').forEach(part => {
                        if (part.indexOf('filename') > -1) {
                            fileName = part.substring(part.indexOf('filename') + 9).trim();
                        }
                    });
                }
                resp.pipe(fs.createWriteStream(`./pdf_files/${fileName}`));
            }
        } else if ((resp.statusCode === 302 || resp.statusCode === 301)
            && resp.headers.location && resp.headers["set-cookie"]) {
            cookie = cookie || '';
            resp.headers["set-cookie"].forEach(_cookie => {
                const cookieParts = _cookie.split(';');
                cookie += cookieParts[0];
            });
            processRequest(pubmedId, resp.headers.location, cookie, originalUrl || url);
        }
    });
}

const querySelectors = {
    'linkinghub.elsevier.com': '.PdfDownloadButton>a'
}

processRequest('01010101', 'https://linkinghub.elsevier.com/retrieve/pii/S0960-894X(98)00113-9');

fs.readFile('./data/test_links.txt', 'utf8', (err, data) => {
    if (err) {
        throw err;
    }
    const rows = data.split('\n');

    var throttle = throttledQueue(1, 1000);

    rows.forEach(row => {

        const cells = row.split('\t');

        throttle(() => {
            processRequest(cells[0], cells[1]);
        });
    });
});