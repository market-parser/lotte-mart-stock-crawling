import playwright from 'playwright';
import {GetMarketService} from "./store/application/get-market.service";
import {PlaywrightLotteMarketClient} from "./lotte-market/playwright-lotte-market.client";
import {GetStockService} from "./stock/application/get-stock.service";
import {StockParser} from "./stock/application/stock.parser";
import {AsyncParser} from "@json2csv/node";
import * as path from "path";
import {createWriteStream} from 'fs';
import {Stock} from "./stock/domain/stock";
import {Market} from "./store/domain/market";
import {logger} from "./util/logger.util";
import dotenv from "dotenv";

dotenv.config();

const lotteMarketWebBaseUrl: string = process.env.BASE_URL as string;

const keywordDelimiter: string = process.env.KEYWORD_DELIMITER as string;
const keywords: string[] = process.env.KEYWORDS?.split(keywordDelimiter) as string[];

const manufacturerDelimiter: string = process.env.MANUFACTURER_DELIMITER as string;
const manufacturers: string[] = process.env.MANUFACTURERS?.split(manufacturerDelimiter) as string[];

async function findAllMarkets() {
    logger.info('find markets...')

    const browser = await playwright.chromium.launch({
        headless: true
    })
    const lotteMarketClient = new PlaywrightLotteMarketClient(lotteMarketWebBaseUrl, browser)
    const getMarketService = new GetMarketService(lotteMarketClient)

    const markets = await getMarketService.findAll();
    await browser.close();

    logger.info(`${markets.length} markets found`)
    return markets;
}

async function findStocksByMarketsAndKeyword(markets: Market[], keyword: string): Promise<Stock[]> {
    logger.info(`find stocks for ${keyword}...`)

    const browser = await playwright.chromium.launch({
        headless: true
    })
    const lotteMarketClient = new PlaywrightLotteMarketClient(lotteMarketWebBaseUrl, browser)
    const stockParser = new StockParser()
    const getStockService = new GetStockService(lotteMarketClient, stockParser)
    const stocks = await getStockService.findAllByMarketsAndKeyword(markets, keyword, manufacturers)
    await browser.close();

    logger.info(`${stocks.length} stocks found for ${keyword}`)
    return stocks;
}

(async () => {
    logger.info('start crawling...')
    const markets = await findAllMarkets();

    const stocks = await Promise.all(
        keywords.map(async (keyword) => await findStocksByMarketsAndKeyword(markets, keyword))
    ).then((stocks) => stocks.flat())

    stocks.sort((a, b) => {
        const areaCompareResult = a.market.area.localeCompare(b.market.area)
        if (areaCompareResult !== 0) {
            return areaCompareResult
        }
        const codeCompareResult = a.market.code.localeCompare(b.market.code)
        if (codeCompareResult !== 0) {
            return codeCompareResult
        }
        return a.name.localeCompare(b.name)
    })

    logger.info('write stocks to csv file...')
    const outputPath = path.join(__dirname, '../', `${new Date().toISOString()}_stocks.csv`)
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
    processor.on('finish', async () => {
        logger.info(`stocks written to ${outputPath}`)
        process.exit(0);
    });
})().catch(exception => {
    logger.error(exception)
    process.exit(1);
});
