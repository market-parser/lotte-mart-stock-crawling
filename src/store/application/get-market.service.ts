import {Area} from "../domain/area";
import {PlaywrightLotteMarketClient} from "../../lotte-market/playwright-lotte-market.client";
import {Market} from "../domain/market";
import {isEmptyOrNull} from "../../util/object.util";
import {ElementHandle, Page} from "playwright";

export class GetMarketService {
    constructor(private readonly client: PlaywrightLotteMarketClient) {
    }

    async findAll(): Promise<Market[]> {
        const markets = await Promise.all(
            Object
                .values(Area)
                .flatMap(async (area) => await this.findAllByArea(area))
        )
        return markets.flat()
    }

    async findAllByArea(area: Area): Promise<Market[]> {
        return await this.client.get<Market[]>('search_market_list.asp', {
            'p_area': area,
            'p_type': 1
        }, async (page) => {
            const marketElements = await this.getMarketElementsFromPage(page)
            return await this.convertToMarketList(area, marketElements)
        })
    }

    private async getMarketElementsFromPage(page: Page): Promise<ElementHandle<HTMLElementTagNameMap["option"]>[]> {
        return await page.$$('option')
    }

    private async convertToMarketList(area: Area, marketElements: ElementHandle<HTMLElementTagNameMap["option"]>[]): Promise<Market[]> {
        const markets = await Promise.all(
            marketElements.map(
                async (marketElement) => await this.convertToMarket(area, marketElement)
            )
        );
        return markets.filter((market) => market !== null) as Market[]
    }

    private async convertToMarket(area: Area, marketElement: ElementHandle<HTMLElementTagNameMap["option"]>): Promise<Market | null> {
        const name = await this.parseNameFromMarketElement(marketElement)
        const code = await this.parseCodeFromMarketElement(marketElement)
        if (isEmptyOrNull(code)) {
            return null
        }
        return new Market(area, name, code!)
    }

    private async parseNameFromMarketElement(marketElement: ElementHandle<HTMLElementTagNameMap["option"]>): Promise<string> {
        return await marketElement.innerText()
    }

    private async parseCodeFromMarketElement(marketElement: ElementHandle<HTMLElementTagNameMap["option"]>): Promise<string | null> {
        return await marketElement.getAttribute('value')
    }
}
