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

app.command('/flaky', async ({command, ack, say}) => {
    await ack();

    try {
        const flakyData = flakyService.getFlakyData();
        if (flakyData === '' || typeof flakyData === "undefined") {
            await say('*Не удалось получить данные flaky-тестов. Нужно подождать до 5 минут. Если не помогает, то перезапустить duty-bot*');
        } else {
            let testWord = slackService.declination(flakyData.itemsCount);
            await say(`*На данный момент есть ${flakyData.itemsCount} ${testWord} с рейтингом прохождения < ${flakyService.getComparisonRate()}%*\n :point_down:`);
            let chunkCount = flakyData.chunkCount;
            for (let i = 0; i <= chunkCount; i++) {
                if (flakyData.message[i]) {
                    let message = await flakyData.message[i].join('\n');
                    await say(`\`\`\`${message}\`\`\``);
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
    await localTunnel(process.env.PORT || 3000, { subdomain: "vi-duty-bot5" }, function(err, tunnel) {
            console.log('localTunnel running')
        });
    await app.start(process.env.PORT || 3000);
    try {
        await flakyService.start();
    } catch (e) {
        console.error(e)
    }
})();