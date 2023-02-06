const googleDocService = require('./google-doc');
const slackService = require('./slack-service');
const flakyService = require('./flaky');
const localTunnel = require('localtunnel');
const {App} = require('@slack/bolt');
require('dotenv').config();

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

app.command('/duty', async ({command, ack, say}) => {
    await ack();

    try {
        const dutyName = googleDocService.getActualDutyName();
        const dutySlackId = googleDocService.getActualDutyId();
        if (dutyName === '' || dutySlackId === '') {
            await say('Не удалось получить значение из таблицы с графиком дежурств');
            return
        }
        if (typeof dutyName === "undefined") {
            await say(`Просыпаюсь... Повторите попытку через несколько секунд`);
        } else {
            await say(`Дежурит ${dutyName}. <@${dutySlackId}>, help!`);
        }

    } catch (e) {
        console.error(e)
    }

});

app.message(/(\/failedRerunTests\.txt).*/, async ({context, message, say}) => {
    const reportProdChannelId = process.env.REPORT_PROD_CHANNEL_ID;
    if (context.matches.input && message.channel === reportProdChannelId) {
        let diff = await slackService.getDiff(reportProdChannelId);
        await slackService.sendReplyToLastMsg(reportProdChannelId, `Сравнил с предыдущим тегом. Новые упавшие тесты:\n :point_down:`);
        // В зависимости от размера отправляемого сообщения (т.е. от количества новых упавших тестов) оно может быть разбито на части
        let chunkCount = diff.chunkCount;
        for (let i = 0; i <= chunkCount; i++) {
            if (diff.message[i]) {
                let message = await diff.message[i].join('\n');
                await slackService.sendReplyToLastMsg(reportProdChannelId, `\`\`\`${message}\`\`\``);
            }
        }

        let testWord = slackService.declination(diff.diffCount);
        if (diff.diffCount <= 5) {
            await slackService.sendReplyToLastMsg(reportProdChannelId, `Упало ${diff.diffCount} ${testWord} :pinching_hand:`);
        }
        if (diff.diffCount > 5 && diff.diffCount <= 30) {
            await slackService.sendReplyToLastMsg(reportProdChannelId, `Упало ${diff.diffCount} ${testWord} :expressionless:`);
        } else if (diff.diffCount > 30 && diff.diffCount <= 60) {
            await slackService.sendReplyToLastMsg(reportProdChannelId, `Упало ${diff.diffCount} ${testWord} :face_with_spiral_eyes:`);
        } else if (diff.diffCount > 60) {
            await slackService.sendReplyToLastMsg(reportProdChannelId, `Упало ${diff.diffCount} ${testWord} :skull_and_crossbones:`);
        }
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
    console.log('⚡️duty-bot готов к работе ⚡');
    await googleDocService.start();
    // await localTunnel(process.env.PORT || 3000, { subdomain: "vi-duty-bot5" }, function(err, tunnel) {
    //         console.log('localTunnel running')
    //     });
    await app.start(process.env.PORT || 3003);
})();