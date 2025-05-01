const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const url = 'https://www.ti.com/technical-documents/techdoc';

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    //this is the first one
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });


    const htmlContent = await page.content();
    let $ = cheerio.load(htmlContent); 


    
    const productValue = $('#productsList option[value!=""]:not([value="-1"])').first().val();
    const productName = $('#productsList option[value="' + productValue + '"]').text().trim();

        //one more Product array would be call for the last for loop to extract the product 

        const subProducts = [];
        $('#subProductsList option[value!=""]:not([value="-1"])').each((i, el) => {
            const value = $(el).attr('value');
            const name = $(el).text().trim();
            subProducts.push({ value, name });
        });

        
        const docTypes = [];
        $('#docCategoryIdList option[value!=""]:not([value="-1"])').each((i, el) => {
            const value = $(el).attr('value');
            const name = $(el).text().trim();
            docTypes.push({ value, name });
        });



        const superFolder = path.join(__dirname, 'superfolders'); 

        await page.select('#productsList', productValue);
        await new Promise(resolve => setTimeout(resolve, 1000));


 for (const sub of subProducts) {
    await page.select('#subProductsList', sub.value);
    await new Promise(resolve => setTimeout(resolve, 1000));

    for (const doc of docTypes) {
        await page.select('#docCategoryIdList', doc.value);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // i hope this timeout giving error
        await page.click('#docSearchBtn');
            const [navResult] = await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
            ]);


        if (navResult?.status === 'rejected') {
            console.warn('⚠️ Navigation timeout after clicking Search — continuing anyway.');
        }

        const viewAllUrl = await page.evaluate(() => {
            const link = Array.from(document.querySelectorAll('a'))
                .find(a => a.textContent.includes('View All Results'));
            if (!link) return null;
            const match = link.getAttribute('href')?.match(/viewAllResults\('(.+?)'\)/);
            return match ? match[1] : null;
        });

           if (viewAllUrl) {
                    console.log('🔁 Navigating to full results:', viewAllUrl);
                    await page.goto(viewAllUrl, { waitUntil: 'load' });
                }

        const result = await page.evaluate(() => {
            const data = [];
            const rows = document.querySelectorAll('table tbody tr');
            for (const row of rows) {
                const titleAnchor = row.querySelector('td ul li a');
                const sizeTd = row.querySelectorAll('td')[2];
                if (titleAnchor && sizeTd) {
                    const title = titleAnchor.textContent.trim();
                    const href = titleAnchor.getAttribute('href')?.startsWith('//')
                        ? 'https:' + titleAnchor.getAttribute('href')
                        : titleAnchor.getAttribute('href');
                    const size = sizeTd.textContent.trim();
                    data.push({ title, pdfUrl: href, size });
                }
            }
            return data;
        });

        const totalPDFs = result.length;
        console.log(`📄 Total PDFs for "${doc.name}": ${totalPDFs}`);

        // Construct folder paths under superfolder
        const productDir = path.join(superFolder, productName);
        const subProductDir = path.join(productDir, sub.name);
        const docTypeDir = path.join(subProductDir, doc.name);

        fs.mkdirSync(docTypeDir, { recursive: true });

        const output = {
            product: { value: productValue, name: productName },
            subProduct: sub,
            docType: doc,
            totalPDFs: totalPDFs,
            pdfs: result,
        };

        const filePath = path.join(docTypeDir, `${doc.name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
        console.log(`✅ Saved ${totalPDFs} PDFs to ${filePath}`);

        // After saving, go back and reinit the form
        await page.goto(url, { waitUntil: 'load' });
        const content = await page.content();
        $ = cheerio.load(content);

        await page.select('#productsList', productValue);
        await page.select('#subProductsList', sub.value);
        await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

    await browser.close();
})();
