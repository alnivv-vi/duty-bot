const googleDocService = require('./google-doc');
const slackService = require('./slack-service');
const flakyService = require('./flaky');
const greenStreak = require('./greenstreak');
const cron = require('node-cron');
const {App} = require('@slack/bolt');
require('dotenv').config();

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

app.command('/duty', async ({command, ack, say}) => {
    await ack();

    try {
        await googleDocService.start();
        const dutySlackId = googleDocService.getActualDutyId();
        if (dutySlackId === '') {
            await say('Не удалось получить значение из таблицы с графиком дежурств. Обратитесь в #site-qa-automation');
            return
        }
        if (typeof dutySlackId === "undefined") {
            await say(`Не удалось определить дежурного. Повторите попытку или обратитесь в #site-qa-automation`);
        } else {
            await say(`Дежурит <@${dutySlackId}>`);
        }

    } catch (e) {
        console.error(e)
    }

});

app.message(/(\/failedRerunTests\.txt).*/, async ({context, message, say}) => {
    const reportProdChannelId = process.env.REPORT_PROD_CHANNEL_ID;
    if (context.matches.input && message.channel === reportProdChannelId) {
        let diff = await slackService.getDiff(reportProdChannelId);
        if (!diff) return;
        if (diff.diffCount === 0) {
            await slackService.sendReplyToLastMsg(reportProdChannelId, `Сравнил этот тег с предыдущим *${diff.previousTagName}*. Новых упаших тестов не появилось :clap:`);
        } else await slackService.sendReplyToLastMsg(reportProdChannelId, `Сравнил этот тег с предыдущим *${diff.previousTagName}*. Новые упавшие тесты:\n :point_down:`);
        // В зависимости от размера отправляемого сообщения (т.е. от количества новых упавших тестов) оно может быть разбито на части
        let chunkCount = diff.chunkCount;
        for (let i = 0; i <= chunkCount; i++) {
            if (diff.message[i]) {
                let message = await diff.message[i].join('\n');
                await slackService.sendReplyToLastMsg(reportProdChannelId, `\`\`\`${message}\`\`\``);
            }
        }
    }
});
app.message(/acceptance\.html[\s\S]*All tests passed!*/, async ({context, message, say}) => {
    const reportProdChannelId = process.env.REPORT_PROD_CHANNEL_ID;

    if (context.matches.input && message.channel === reportProdChannelId) {
        let result = await greenStreak._checkGreenStreak();
        console.log(result)
        if (result) await slackService.sendReplyToLastMsg(reportProdChannelId, `:dance: :dance: :dance: Green streak ${result} days! :dance: :dance: :dance:`);
    }
});

app.command('/flaky', async ({command, ack, say, client}) => {
    await ack();

    try {
        await client.views.open({
            trigger_id: command.trigger_id,
            view: {
                "callback_id": "flaky_callback",
                "type": "modal",
                "title": {
                    "type": "plain_text",
                    "text": "Показать flaky-тесты"
                },
                "submit": {
                    "type": "plain_text",
                    "text": "Показать"
                },
                "close": {
                    "type": "plain_text",
                    "text": "Отменить"
                },
                "blocks": [
                    {
                        "block_id": "rate_value",
                        "type": "input",
                        "element": {
                            "type": "number_input",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "число от 1 до 100"
                            },
                            "is_decimal_allowed": false,
                            "action_id": "number_input_action"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Введите порог прохождения тестов в %"
                        }
                    }
                ]
            }
        });
    } catch (e) {
        console.error(e)
    }
});

app.view('flaky_callback', async ({ack, view, client},) => {
    try {
        const rateValue = view.state.values.rate_value.number_input_action.value;
        console.log(`Введенное значение рейтинга = ${rateValue}%`);
        await ack({
            "response_action": "update",
            "view": {
                "type": "modal",
                "title": {
                    "type": "plain_text",
                    "text": "Данные успешно приняты"
                },
                "close": {
                    "type": "plain_text",
                    "text": "ОK"
                },
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "plain_text",
                            "text": "Результаты отправлены в канал #site-autotest-report-flaky"
                        }
                    }
                ]
            },
        });
        await flakyService.start(rateValue);
        const flakyData = flakyService.getFlakyData();
        if (flakyData === '' || typeof flakyData === "undefined") {
            await client.chat.postMessage({
                channel: process.env.FLAKY_CHANNEL,
                text: `*Не удалось получить данные flaky-тестов. Подождите или попросите перезапустить duty-bot*`,
            });
        } else {
            let testWord = slackService.declination(flakyData.itemsCount);
            await client.chat.postMessage({
                channel: process.env.FLAKY_CHANNEL,
                text: `*На данный момент есть ${flakyData.itemsCount} ${testWord} с рейтингом прохождения < ${rateValue}%*\n :point_down:`,
            });
            let chunkCount = flakyData.chunkCount;
            for (let i = 0; i <= chunkCount; i++) {
                if (flakyData.message[i]) {
                    let message = await flakyData.message[i].join('\n');
                    await client.chat.postMessage({
                        channel: process.env.FLAKY_CHANNEL,
                        text: `\`\`\`${message}\`\`\``,
                    });
                }
            }
        }

    } catch (e) {
        console.error(e)
    }
});

(async () => {
    console.log('⚡️duty-bot готов к работе ⚡️');
    // await googleDocService.start();
    // cron.schedule('20 17 * * 1-5', () => {
    //     console.log('Running a job at 09:00 at Moscow timezone');
    //     console.log('sendMsgToSiteQaAutomation Cron started');
    //     googleDocService.start();
    //     const dutySlackId = googleDocService.getActualDutyId();
    //     if (dutySlackId === '') {
    //        slackService.sendMsgToSiteQaAutomation('Не удалось получить значение из таблицы с графиком дежурств');
    //     } else if (typeof dutySlackId === "undefined") {
    //        slackService.sendMsgToSiteQaAutomation('Не удалось определить дежурного');
    //     } else {
    //         slackService.sendMsgToSiteQaAutomation(`Дежурит <@${dutySlackId}>`)
    //     }
    // }, {
    //     scheduled: true,
    //     timezone: "Europe/Moscow"
    // });
    await cron.schedule('* * * * *', function() {
        console.log('running a task every minute');
    });
    await app.start(process.env.PORT || 3000);
})();
