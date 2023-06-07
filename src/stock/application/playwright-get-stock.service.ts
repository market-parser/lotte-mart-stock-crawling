import {PlaywrightLotteMarketClient} from "../../lotte-market/playwright-lotte-market.client";
import {Market} from "../../store/domain/market";
import {Stock} from "../domain/stock";
import {StockParser} from "./stock.parser";
import {ElementHandle, Page} from "playwright";
import Pino from "pino";
import {logger} from "../../util/logger.util";

export class PlaywrightGetStockService {
    private static readonly START_PAGE_NUMBER = 1

    constructor(private readonly client: PlaywrightLotteMarketClient, private readonly stockParser: StockParser) {
    }

    async findAllByMarketsAndKeyword(markets: Market[], keyword: string, manufacturers: string[]): Promise<Stock[]> {
        const stocks = []
        for (const market of markets) {
            stocks.push(...await this.findAllByMarketAndKeyword(market, keyword, manufacturers))
        }
        return stocks
    }

    async findAllByMarketAndKeyword(market: Market, keyword: string, manufacturers: string[]): Promise<Stock[]> {
        const stocks: Stock[] = []
        let pageNumber = PlaywrightGetStockService.START_PAGE_NUMBER

        while (true) {
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
        return await this.client.get<Stock[]>('search_product_list.asp', {
            'p_market': market.code,
            'p_schWord': keyword,
            page: pageNumber
        }, async (page) => {
            const stockElements = await this.getStockElementsFromPage(page)
            const stocks = await this.convertToStockList(market, stockElements)

            return stocks.filter((stock) => manufacturers.includes(stock.manufacturer))
        })
    }

    private async getStockElementsFromPage(page: Page): Promise<ElementHandle<HTMLElementTagNameMap["li"]>[]> {
        return await page.$$(`li`)
    }

    private async convertToStockList(market: Market, stockElements: ElementHandle<HTMLElementTagNameMap["li"]>[]): Promise<Stock[]> {
        return await Promise.all(
            stockElements.map(async (stockElement) => await this.convertToStock(market, stockElement))
        )
    }

    private async convertToStock(market: Market, stockElement: ElementHandle<HTMLElementTagNameMap["li"]>): Promise<Stock> {
        const productElement = await this.getProductElementFromStockElement(stockElement)
        const detailsElement = await this.getDetailsElementFromProductElement(productElement)

        const name = await this.parseNameFromProductElement(productElement)
        const manufacturer = await this.parseManufacturerFromDetailsElement(detailsElement)
        const unit = await this.parseUnitFromDetailsElement(detailsElement)
        const price = await this.parsePriceFromDetailsElement(detailsElement)
        const stock = await this.parseStockFromDetailsElement(detailsElement)

        return new Stock(market, name, manufacturer, unit, price, stock)
    }

    private async getProductElementFromStockElement(stockElement: ElementHandle<HTMLElementTagNameMap["li"]>): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const element = await stockElement.$(`.layer_wrap > .layer_popup`)
        if (element === null) {
            throw new Error('product element not found.')
        }
        return element;
    }

    private async getDetailsElementFromProductElement(productElement: ElementHandle<SVGElement | HTMLElement>): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const detailsElement = await productElement.$('.info-list')
        if (detailsElement === null) {
            throw new Error('details element not found.')
        }
        return detailsElement;
    }

    private async parseNameFromProductElement(productElement: ElementHandle<SVGElement | HTMLElement>): Promise<string> {
        const nameElement = await productElement.$('.layer-head')
        if (nameElement === null) {
            throw new Error('name element not found.')
        }
        return await nameElement.innerText();
    }

    private async parseManufacturerFromDetailsElement(detailsElement: ElementHandle<SVGElement | HTMLElement>): Promise<string> {
        const manufacturerElement = await detailsElement.$('tbody > tr:nth-child(1) > td')
        if (manufacturerElement === null) {
            throw new Error('manufacturer element not found.')
        }
        return await manufacturerElement.innerText();
    }

    private async parseUnitFromDetailsElement(detailsElement: ElementHandle<SVGElement | HTMLElement>): Promise<string> {
        const unitElement = await detailsElement.$('tbody > tr:nth-child(2) > td')
        if (unitElement === null) {
            throw new Error('unit element not found.')
        }
        return await unitElement.innerText();
    }

    private async parsePriceFromDetailsElement(detailsElement: ElementHandle<SVGElement | HTMLElement>): Promise<number> {
        const priceElement = await detailsElement.$('tbody > tr:nth-child(3) > td')
        if (priceElement === null) {
            throw new Error('price element not found.')
        }
        const value = await priceElement.innerText();
        return this.stockParser.parsePrice(value)
    }

    private async parseStockFromDetailsElement(detailsElement: ElementHandle<SVGElement | HTMLElement>): Promise<number> {
        const stockElement = await detailsElement.$('tbody > tr:nth-child(4) > td')
        if (stockElement === null) {
            throw new Error('stock element not found.')
        }
        const value = await stockElement.innerText();
        return this.stockParser.parseStock(value)
    }
}
