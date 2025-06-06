import axios from 'axios';
import { Currency } from '../models/currency.model';

const exchange_rate_key = process.env.EXCHANGE_RATE_API_KEY;
const BASE_URL = 'https://v6.exchangerate-api.com/v6';

interface ExchangeRateResponse {
    result: string;
    documentation: string;
    terms_of_use: string;
    time_last_update_unix: number;
    time_last_update_utc: string;
    time_next_update_unix: number;
    time_next_update_utc: string;
    base_code: string;
    conversion_rates: Record<string, number>
}

export const updateExchangeRate = async (userId: string, baseCurrency: string) => {
    try {
        const response = await axios.get<ExchangeRateResponse>(
            `${BASE_URL}/${exchange_rate_key}/latest/${baseCurrency}`
        );

        console.log(response.data.conversion_rates);
        if(response.data.result !== "success"){
            throw new Error("Failed to fetch exchange rates");
        }

        const {conversion_rates, time_last_update_unix} = response.data;
        // Update all currencies for this user
        const currencies = await Currency.find({user: userId});
        const updateOps = currencies.map((currency) => {
            if(currency.code === baseCurrency){
                return {
                    updateOne: {
                        filter: {_id: currency._id},
                        update: {
                            exchangeRate: 1,
                            lastUpdated: new Date(time_last_update_unix * 1000)
                        }
                    }
                }
            }

            const rate = conversion_rates[currency.code];
            if(!rate) return null;
            return {
                updateOne: {
                    filter: {_id: currency._id},
                    update: {
                        exchangeRate: rate,
                        lastUpdated: new Date(time_last_update_unix * 1000),
                      },
                }
            }
        
        }).filter(Boolean);

        if(updateOps.length > 0) {
            await Currency.bulkWrite(updateOps as any)
        }


    } catch (error) {
        console.error('Error updating exchange rates:', error);
    return false;
    }
}


