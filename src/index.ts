import playwright from 'playwright';
import {GetMarketService} from "./store/application/get-market.service";
import {PlaywrightLotteMarketClient} from "./lotte-market/playwright-lotte-market.client";
import {GetStockService} from "./stock/application/get-stock.service";
import {StockParser} from "./stock/application/stock.parser";
import {AsyncParser} from "@json2csv/node";
import * as fs from "fs";
import * as path from "path";
import {createWriteStream} from 'fs';

// TODO apply dotenv to load environment variables
const BASE_URL = 'https://company.lottemart.com/mobiledowa/inc/asp'
const keywords = ['하이네켄', '에델바이스']; // 타이거 맥주
// const manufacturerFilters = [];

(async () => {
    console.log('initialize dependencies...')
    console.log('initialize playwright browser...')
    const browser = await playwright.chromium.launch({
        headless: true
    })
    console.log('playwright browser initialized')

    // TODO apply dependency injection using typedi
    const lotteMarketClient = new PlaywrightLotteMarketClient(BASE_URL, browser)

    const getMarketService = new GetMarketService(lotteMarketClient)
    const stockParser = new StockParser()
    const getStockService = new GetStockService(lotteMarketClient, stockParser)
    console.log('dependencies initialized')

    console.log('start crawling...')
    console.log('find markets...')
    const markets = await getMarketService.findAll();
    console.log(`${markets.length} markets found`)

    console.log('find stocks...')
    const stocks = (await Promise.all(
            keywords.flatMap(async (keyword) =>
                await getStockService.findAllByMarketsAndKeyword(markets, keyword)
            )
        )
    ).flat();
    stocks.sort((a, b) => {
        return a.market.code.localeCompare(b.market.code)
    })
    console.log(`${stocks.length} stocks found`)

    console.log('write stocks to csv file...')
    const outputPath = path.join(__dirname, `${new Date().toISOString()}_stocks.csv`)
    const output = createWriteStream(outputPath, {encoding: 'utf8'});
    const parser = new AsyncParser({
        fields: [
            {label: '지역', value: 'market.area'},
            {label: '마켓', value: 'market.name'},
            {label: '마켓 코드', value: 'market.code'},
            {label: '상품명', value: 'name'},
            {label: '제조사', value: 'manufacturer'},
            {label: '단위', value: 'unit'},
            {label: '가격', value: 'price'},
            {label: '재고', value: 'stock'},
        ],
    }, {}, {});
    const processor = parser.parse(stocks).pipe(output);
    processor.on('finish', () => {
        console.log(`stocks written to ${outputPath}`)
        process.exit(0);
    });
})().catch(exception => {
    console.error(exception)
    process.exit(1);
});
