import {AxiosInstance} from "axios";
import {Market} from "../domain/market";
import {Area} from "../domain/area";
import parse, {HTMLElement} from "node-html-parser";
import {isInvalidValue} from "../../util/object.util";

export class AxiosGetMarketService {
    constructor(private readonly client: AxiosInstance) {
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
        const {data} = await this.client.get('search_market_list.asp', {
            params: {
                'p_area': area,
                'p_type': 1
            }
        })
        const parsedData = parse(data)
        const marketElements = this.getMarketElements(parsedData)
        return this.convertToMarketList(area, marketElements)
    }

    private getMarketElements(element: HTMLElement): HTMLElement[] {
        return element.getElementsByTagName('option')
    }

    private convertToMarketList(area: Area, marketElements: HTMLElement[]): Market[] {
        const markets = marketElements.map(marketElement => this.convertToMarket(area, marketElement))
        return markets.filter((market) => market !== null) as Market[]
    }

    private convertToMarket(area: Area, marketElement: HTMLElement): Market | null {
        const name = this.parseNameFromMarketElement(marketElement)
        const code = this.parseCodeFromMarketElement(marketElement)
        if (isInvalidValue(code)) {
            return null
        }
        return new Market(area, name, code!)
    }


    private parseNameFromMarketElement(marketElement: HTMLElement): string {
        return marketElement.innerText
    }

    private parseCodeFromMarketElement(marketElement: HTMLElement): string | null {
        return marketElement.getAttribute('value') || null
    }
}
