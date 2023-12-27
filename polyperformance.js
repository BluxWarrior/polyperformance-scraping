const puppeteer = require('puppeteer');
const fs = require('fs');
const { exec } = require('child_process');
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getbyoption(page) {
    const optionData = await page.evaluate(() => {
        const skuElement = document.querySelector('div[itemprop="sku"]');
        const finalpriceElement = document.querySelector('span[data-price-type="finalPrice"]');
        const oldpriceElement = document.querySelector('span[data-price-type="oldPrice"]');
        // let imageDivs = document.querySelectorAll('div[class="fotorama__thumb fotorama_vertical_ratio fotorama__loaded fotorama__loaded--img"]');
        // console.log(imageDivs)
        // if (imageDivs.length === 0) {
        let imageDivs = document.querySelectorAll('div[class*="fotorama__stage__frame"]')
        // }


        let skuNumber = skuElement ? skuElement.textContent : '';
        let finalprice = finalpriceElement ? finalpriceElement.textContent.replace('$', '') : '';
        let oldprice = oldpriceElement ? oldpriceElement.textContent.replace('$', '') : '';
        // let description = descriptionElement ? descriptionElement.innerHTML.trim() : '';
        let images = [];

        imageDivs.forEach(div => {
            let img = div.querySelector('img');
            if (img && img.src) {
                images.push(img.src);
            }
        });

        return { 'skuNumber': skuNumber, 'finalprice': finalprice, 'oldprice': oldprice, 'images': images };
    });
    return optionData
}

async function polyperformance(pd) {
    // Launch a browser instance
    // console.log(pd)
    const browserURL = 'http://127.0.0.1:9222';

    const browser = await puppeteer.connect({ browserURL });
    const page = (await browser.pages())[0];

    // const browser = await puppeteer.launch({ headless: false });
    // // Create a new page
    // const page = await browser.newPage();

    // Navigate to the desired URL
    await page.goto(pd['url'], { timeout: 60000 });
    await sleep(3000);
    
    const options = await page.evaluate(() => {
        let options = [];
        const divOptions = document.querySelector('.super-attribute-select');
        if (divOptions) {
            const optionElements = divOptions.querySelectorAll('option');
            optionElements.forEach((option, index) => {
                if (index > 0) {
                    options.push({'name': option.textContent.trim(), 'value' :option.value});
                    // const value = option.value;
                    // console.log(value);
                    // divOptions.value = value;
                    // divOptions
                }
            });
        }
        return options
    });

    const description = await page.evaluate(() => {
        const descriptionElement = document.querySelector('.product.attribute.description');
        let description = descriptionElement ? descriptionElement.innerHTML.trim() : '';
        return description;
    });

    let productData = {
        'options': [],
        'brand': pd['brand'],
        'name': pd['name'],
        'url': pd['url'],
        'dscription': description
    }

    let count = 0;
    {
        let optionData = await getbyoption(page);
        while (optionData['images'].length === 0) {
            if (count > 5) throw new Error('Forced exception: Something went wrong!');
            console.log(pd['url']);
            await page.goto(pd['url']);
            await sleep(3000);
            optionData = await getbyoption(page);
            count ++;
        }
        optionData['optionname'] = 'original';
        productData['options'].push(optionData);
    }

    for (const option of options) {
        // console.log(optionname);
        
        await page.select('.super-attribute-select', option['value']);
        await sleep(3000);
        
        let optionData = await getbyoption(page);
        while (optionData['images'].length === 0) {
            if (count > 5) throw new Error('Forced exception: Something went wrong!');
            console.log(pd['url']);
            await page.goto(pd['url']);
            await sleep(3000);
            await page.select('.super-attribute-select', option['value']);
            await sleep(3000);
            optionData = await getbyoption(page);

            count ++;
        }
        optionData['optionname'] = option['name'];
        productData['options'].push(optionData);

        // const searchText = `//div[contains(text(), '${optionname}')]`;
        // await clickByText(page, optionname);
    }




    return productData;
}




async function run() {

    const products = JSON.parse(fs.readFileSync('products.json', 'utf8'));
    
    let numberoffiles = fs.readdirSync('./data').length;
    console.log(numberoffiles);
    let file_path = `./data/data${numberoffiles-1}.json`;
    let data = JSON.parse(fs.readFileSync(file_path, 'utf8'));
    const sizeofbunch = 100;
    // polyperformance(products[0])
    // Process each product synchronously
    for (const pd of products.slice((numberoffiles-1) * sizeofbunch + data.length)) {
        if (data.length == sizeofbunch) {
            numberoffiles ++;
            file_path = `./data/data${numberoffiles-1}.json`;
            data = [];
        }
        await sleep(1000);
        exec('killall chrome');
        await sleep(1000);
        exec('/opt/google/chrome/chrome --profile-directory="Default" --guest --remote-debugging-port=9222');
        await sleep(1000);

        let product = await polyperformance(pd); // Wait for each call to finish before proceeding
        
        data.push(product);
        // console.log(data);
        const jsonContent = JSON.stringify(data, null, 2);
        fs.writeFileSync(file_path, jsonContent, 'utf8', (err) => {
            if (err) {
                console.error('An error occurred:', err);
                return;
            }
            console.log('JSON file has been saved.');
        });
    }
};

(async () => {
    while (true) {
        try {
            await run();
        } catch (error) {
            console.log(error);
        };
    }
})();