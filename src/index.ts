import {StockParser} from "./stock/application/stock.parser";
import {Stock} from "./stock/domain/stock";
import {Market} from "./store/domain/market";
import {logger} from "./util/logger.util";
import dotenv from "dotenv";
import axios from "axios";
import {AxiosGetMarketService} from "./store/application/axios-get-market.service";
import {AxiosGetStockService} from "./stock/application/axios-get-stock.service";
import * as path from "path";
import {AsyncParser} from "@json2csv/node";
import * as fs from "fs";

dotenv.config();

const lotteMarketWebBaseUrl: string = process.env.BASE_URL as string;

const keywordDelimiter: string = process.env.KEYWORD_DELIMITER as string;
const keywords: string[] = process.env.KEYWORDS?.split(keywordDelimiter) as string[];

const manufacturerDelimiter: string = process.env.MANUFACTURER_DELIMITER as string;
const manufacturers: string[] = process.env.MANUFACTURERS?.split(manufacturerDelimiter) as string[];

const axiosClient = axios.create({
    baseURL: lotteMarketWebBaseUrl,
    responseType: 'document',
})
const stockParser = new StockParser()
const getMarketService = new AxiosGetMarketService(axiosClient)
const getStockService = new AxiosGetStockService(axiosClient, stockParser)

async function findAllMarkets() {
    logger.info('find markets...')

    const markets = await getMarketService.findAll()

    logger.info(`${markets.length} markets found`)
    return markets;
}

async function findStocksByMarketsAndKeyword(markets: Market[], keyword: string): Promise<Stock[]> {
    logger.info(`find stocks for ${keyword}...`)
    const stocks = await getStockService.findAllByMarketsAndKeyword(markets, keyword, manufacturers)

    logger.info(`${stocks.length} stocks found for ${keyword}`)
    return stocks;
}

(async () => {
    logger.info('start crawling...')

    const markets = await findAllMarkets();

    const marketStocks = await Promise.all(
        keywords.map(async (keyword) => await findStocksByMarketsAndKeyword(markets, keyword))
    )
    const stocks = marketStocks.flat()

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
    const outputPath = path.join(__dirname, '../', `stocks.csv`)
    const output = fs.createWriteStream(outputPath, {encoding: 'utf8'});
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
