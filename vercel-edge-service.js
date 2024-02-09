const fetch = require('node-fetch');
const moment = require("moment/moment");
const ConfigSingleton = require('./vercel-config');
const Holidays = require('date-holidays');
class VercelEdgeService {


    async _getGreenstreakLastDate() {
        const config = new ConfigSingleton;
        const lastDate = await config.config.get('greenstreak_last_date');
        return lastDate.toString()
    }

    async _getGreenstreakLength() {
        const config = new ConfigSingleton;
        return await config.config.get('greenstreak_length')
    }

    async _checkDates() {
        let dateString = await this._getGreenstreakLastDate()
        let lastDate = new Date(dateString)
        const currentDate = new Date();
        let result = null;

    // Устанавливаем обе даты на начало дня
        lastDate.setHours(0, 0, 0, 0);
        currentDate.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(currentDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            console.log('Сегодня уже был greenstreak'); // Прошлая дата соответствует сегодняшнему дню
        } else if (diffDays === 1) {
            console.log('Продлеваем greenstreak')
            let currentLength = await this._getGreenstreakLength()
            let newLength = Number(currentLength) + Number(1)
            await this._updateGreenstreak(newLength)
            result = newLength
        } else if (diffDays > 1) {
            console.log('Проверяем, был ли рабочий день в диапазоне между lastDate и currentDate')
            for (let i = 1; i <= diffDays; i++) {
                let date = lastDate.setDate(lastDate.getDate() + i);
                console.log("date - " + date)
                // Проверяем, является ли день рабочим
                let isWorkingDay = await this._isWorkingDay(date);
                console.log("isWorkingDay - " + isWorkingDay)
                if (isWorkingDay) {
                    console.log('Зеленая серия прерывалась в дату: ' + new Date(date))
                    // если зеленая серия прерывалась, то проставляем текущий greenstreak = 1
                    await this._updateGreenstreak(Number(1))
                    break;
                } else {

                }
                // если все дни в промежутке между lastDate и currentDate были нерабочими, то продлеваем greenstreak
                let currentLength = await this._getGreenstreakLength()
                let newLength = Number(currentLength) + Number(1)
                await this._updateGreenstreak(newLength)
            }
        }
        return result
    }

    // Функция для проверки, является ли текущий день рабочим
    async _isWorkingDay(day) {
        const date = moment(day);
        console.log(date)
        // Проверяем, что день является будним (6 и 7 - суббота и воскресенье)
        let isWorkingDay = date.isoWeekday() < 6;
        console.log("isWorkingDay - " + isWorkingDay)
        // Проверяем, является ли день праздничным
        let isHoliday = await this._isHoliday(date)
        console.log("isHoliday - " + isHoliday)
        if (isWorkingDay && !isHoliday) {
            return true
        }
        else return false
    }

    async _updateGreenstreak(value) {
        const id = process.env.EDGE_CONFIG_ID
        const url = `https://api.vercel.com/v1/edge-config/${id}/items`;
        const token = process.env.VERCEL_API_TOKEN;
        let dateObjMSK = new Date().toLocaleString("en-US", {timeZone: "Europe/Moscow"})
        console.log(dateObjMSK)
        let todayDate = dateObjMSK.toISOString().slice(0, 10);
        console.log(todayDate)
        const options = {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: [
                    {
                        operation: 'update',
                        key: 'greenstreak_length',
                        value: value,
                    },
                    {
                        operation: 'update',
                        key: 'greenstreak_last_date',
                        value: todayDate,
                    },
                ],
            }),
        };

        fetch(url, options)
            .then(response => {
                if (!response.ok) {
                    console.log(response)
                    throw new Error("HTTP error! status: " + response.status);
                }
                return response.json();
            })
            .then(data => {
                console.log('Response:', data);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

    async _isHoliday(date) {
        const hd = new Holidays();
        hd.init('RU');
        const dateObj = new Date(date);
        const isHoliday = hd.isHoliday(dateObj);
        return !!isHoliday;
    }
}

module.exports = (function () {
    return new VercelEdgeService();
})();

