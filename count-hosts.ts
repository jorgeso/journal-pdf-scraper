import { URL } from 'url';
import * as fs from 'fs';

fs.readFile('./data/publication_links.txt', 'utf8', (err, data) => {
    processLinksData(data);
});

function processLinksData(data: string): void {
    const rows = data.split('\n');
    const hostsCount = {};
    rows.forEach(row => {
        const cells = row.split('\t');
        const url = new URL(cells[1]);
        if (!hostsCount[url.host]) {
            hostsCount[url.host] = 0;
        }
        hostsCount[url.host]++
    });
    const counts = [];
    Object.keys(hostsCount).forEach(host => {
        const countObject = {
            host: host,
            count: hostsCount[host]
        }
        counts.push(countObject);
    });

    counts.sort((a, b) => {
        return b.count - a.count;
    });

    counts.forEach(count => {
        fs.appendFile('./data/hosts-count.txt', `${count.host}: ${count.count}\n`, (err) => {});
    });
}