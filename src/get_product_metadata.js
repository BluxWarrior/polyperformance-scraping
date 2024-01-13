const puppeteer = require('puppeteer');
const fs = require('fs');
const { exec } = require('child_process');
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_metadata(page, brand) {

    await page.goto(`${brand['url']}?product_list_limit=all`, { timeout: 60000 });

    await sleep(3000);

    let metadata = {
        "brand name": brand["name"],
        "brand url": brand["url"]
    }
    const products = await page.evaluate(() => {
        let products = [];
        const brandDivs = document.querySelectorAll('strong[class="product name product-item-name"]');
        if (brandDivs) {
            brandDivs.forEach((div) => {
                const productname = div.textContent.trim();
                const producturl = div.querySelector('a').href;

                products.push({
                    name: productname,
                    url: producturl
                });
            });
        }
        return products;
    });

    metadata["products"] = products;
    return metadata;
}

async function get_product_metadata(numberofprocess = 4) {
    const brands = JSON.parse(fs.readFileSync('./assets/brands.json', 'utf8'));
    const chunksize = Math.ceil(brands.length / numberofprocess);

    let products = { 'completed': false, 'data': [] };

    for (let i = 0; i < numberofprocess; i++)
        products['data'].push([]);
    // check if the mata file exists
    if (fs.existsSync('./assets/metadata.json')) products = JSON.parse(fs.readFileSync('./assets/metadata.json', 'utf8'));


    const singleProcess = async (processnumber) => {
        console.log(processnumber)
        let finished = false
        while (!finished) {
            console.log(finished)
            exec(`/opt/google/chrome/chrome --user-data-dir=/tmp/chrome-profile${processnumber} --guest --remote-debugging-port=${9222 + processnumber}`);
            await sleep(1000);

            const browserURL = `http://127.0.0.1:${9222 + processnumber}`;

            const browser = await puppeteer.connect({ browserURL });
            const page = (await browser.pages())[0];


            try {
                for (const bd of brands.slice(chunksize * processnumber + products['data'][processnumber].length, chunksize * (processnumber + 1))) {
                    console.log(bd["url"]);
                    brandproducts = await get_metadata(page, bd);
                    if (brandproducts['products'].length === 0) throw new Error('Forced exception: No products!');

                    products['data'][processnumber].push(brandproducts);

                    const jsonContent = JSON.stringify(products, null, 2);
                    fs.writeFileSync('./assets/metadata.json', jsonContent, 'utf8', (err) => {
                        if (err) {
                            console.error('An error occurred:', err);
                            return;
                        }
                        console.log('JSON file has been saved.');
                    });
                }

                finished = true;
                browser.close();
            } catch (error) {
                console.log(error);
                browser.close();
            }
        }
    }


    const processes = [];
    for (let processnumber = 0; processnumber < numberofprocess; processnumber++) {
        processes.push(singleProcess(processnumber)); // Assuming the process numbers start from 0 and increment by 1
    }

    await Promise.all(processes).then(() => {
        products['completed'] = true;
        let data = []
        for (const subcat of categories['data'])
            data = data.concat(subcat)
        products['data'] = data;

        const jsonContent = JSON.stringify(products, null, 2);

        fs.writeFileSync("./assets/categories.json", jsonContent, "utf8", (err) => {
            if (err) {
                console.error("An error occurred:", err);
                return;
            }
            console.log("JSON file has been saved.");
        });
    })
}


module.exports = get_product_metadata;