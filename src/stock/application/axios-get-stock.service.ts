import parse, {HTMLElement} from "node-html-parser";
import {Market} from "../../store/domain/market";
import {Stock} from "../domain/stock";
import {StockParser} from "./stock.parser";
import {logger} from "../../util/logger.util";
import {AxiosInstance} from "axios";

export class AxiosGetStockService {
    private static readonly START_PAGE_NUMBER = 1

    constructor(private readonly client: AxiosInstance, private readonly stockParser: StockParser) {
    }

    async findAllByMarketsAndKeyword(markets: Market[], keyword: string, manufacturers: string[]): Promise<Stock[]> {
        const marketStocks = []
        for (const market of markets) {
            const stocks = await this.findAllByMarketAndKeyword(market, keyword, manufacturers)
            marketStocks.push(...stocks)
        }
        return marketStocks
    }

    async findAllByMarketAndKeyword(market: Market, keyword: string, manufacturers: string[]): Promise<Stock[]> {
        const stocks: Stock[] = []
        let pageNumber = AxiosGetStockService.START_PAGE_NUMBER
        logger.debug(`find stocks for ${market.name} ${keyword}...`)
        while (true) {
            logger.debug(`find stocks for ${market.name} ${keyword} page ${pageNumber}...`)
            const paginatedStocks = await this.findAllByMarketAndKeywordAndPageNumber(market, keyword, manufacturers, pageNumber)
            if (paginatedStocks.length === 0) {
                break
            }
            stocks.push(...paginatedStocks)
            pageNumber += 1
        }
        logger.debug(`${stocks.length} stocks found for ${market.name} ${keyword}`)
        return stocks
    }

    private async findAllByMarketAndKeywordAndPageNumber(market: Market, keyword: string, manufacturers: string[], pageNumber: number): Promise<Stock[]> {
        const {data} = await this.client.get('search_product_list.asp', {
            params: {
                'p_market': market.code,
                'p_schWord': keyword,
                page: pageNumber
            },
        })

        const parsedData = parse(data)

        const stockElements = this.getStockElements(parsedData)
        const stocks = await this.convertToStockList(market, stockElements)

        return stocks.filter((stock) => {
            const res = manufacturers.includes(stock.manufacturer)
            if (!res) {
                logger.debug(`skip ${stock.manufacturer} ${stock.name}`)
            }
            return res
        })
    }

    private getStockElements(element: HTMLElement): HTMLElement[] {
        return element.getElementsByTagName('li')
    }

    private async convertToStockList(market: Market, stockElements: HTMLElement[]): Promise<Stock[]> {
        return await Promise.all(
            stockElements.map(async (stockElement) => await this.convertToStock(market, stockElement))
        )
    }

    private async convertToStock(market: Market, stockElement: HTMLElement): Promise<Stock> {
        const productElement = await this.getProductElement(stockElement)
        const detailsElement = await this.getDetailsElement(productElement)

        const name = this.parseNameFromProductElement(productElement)
        const manufacturer = this.parseManufacturerFromDetailsElement(detailsElement)
        const unit = this.parseUnitFromDetailsElement(detailsElement)
        const price = this.parsePriceFromDetailsElement(detailsElement)
        const stock = this.parseStockFromDetailsElement(detailsElement)

        return new Stock(market, name, manufacturer, unit, price, stock)
    }

    private getProductElement(stockElement: HTMLElement): HTMLElement {
        const element = stockElement.querySelector(`.layer_wrap > .layer_popup`)
        if (element === null) {
            throw new Error('product element not found.')
        }
        return element;
    }

    private getDetailsElement(productElement: HTMLElement): HTMLElement {
        const detailsElement = productElement.querySelector('.info-list')
        if (detailsElement === null) {
            throw new Error('details element not found.')
        }
        return detailsElement;
    }

    private parseNameFromProductElement(productElement: HTMLElement): string {
        const nameElement = productElement.querySelector('.layer-head')
        if (nameElement === null) {
            throw new Error('name element not found.')
        }
        return nameElement.innerText;
    }

    private parseManufacturerFromDetailsElement(detailsElement: HTMLElement): string {
        const manufacturerElement = detailsElement.querySelector('tbody > tr:nth-child(1) > td')
        if (manufacturerElement === null) {
            throw new Error('manufacturer element not found.')
        }
        return manufacturerElement.innerText;
    }

    private parseUnitFromDetailsElement(detailsElement: HTMLElement): string {
        const unitElement = detailsElement.querySelector('tbody > tr:nth-child(2) > td')
        if (unitElement === null) {
            throw new Error('unit element not found.')
        }
        return unitElement.innerText;
    }

    private parsePriceFromDetailsElement(detailsElement: HTMLElement): number {
        const priceElement = detailsElement.querySelector('tbody > tr:nth-child(3) > td')
        if (priceElement === null) {
            throw new Error('price element not found.')
        }
        const value = priceElement.innerText;
        return this.stockParser.parsePrice(value)
    }

    private parseStockFromDetailsElement(detailsElement: HTMLElement): number {
        const stockElement = detailsElement.querySelector('tbody > tr:nth-child(4) > td')
        if (stockElement === null) {
            throw new Error('stock element not found.')
        }
        const value = stockElement.innerText;
        return this.stockParser.parseStock(value)
    }
}
