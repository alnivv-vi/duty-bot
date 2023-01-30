const googleDocService = require('./google-doc.js');
const slackService = require('./slack-service');
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

app.message(/(\/failedRerunTests\.txt).*/, async ({ context,message, say }) => {
    const reportProdChannelId = process.env.REPORT_PROD_CHANNEL_ID;
    if (context.matches.input && message.channel === reportProdChannelId) {
        let diff = await slackService.getDiff(reportProdChannelId);
        await slackService.sendReplyToLastMsg(reportProdChannelId, `Сравнил с предыдущим тегом. Новые упавшие тесты:\n :point_down:`);
        // В зависимости от размера отправляемого сообщения (т.е. от количества новых упавших тестов) оно может быть разбито на части
        let chunkCount = diff.chunkCount;
        for (let i = 0; i <= chunkCount; i++) {
            if (diff.message[i]) { let message = await diff.message[i].join('\n');
                await slackService.sendReplyToLastMsg(reportProdChannelId, `\`\`\`${message}\`\`\``);}
        }
        if (diff.diffCount <= 5) {
            await slackService.sendReplyToLastMsg(reportProdChannelId, `Упало ${diff.diffCount} новых тестов :pinching_hand:`);
        }
        if (diff.diffCount > 5 && diff.diffCount <= 30) {
            await slackService.sendReplyToLastMsg(reportProdChannelId, `Упало ${diff.diffCount} новых тестов :expressionless:`);
        } else if (diff.diffCount > 30 && diff.diffCount <= 60) {
            await slackService.sendReplyToLastMsg(reportProdChannelId, `Упало ${diff.diffCount} новых тестов :face_with_spiral_eyes:`);
        } else if (diff.diffCount > 60) {
            await slackService.sendReplyToLastMsg(reportProdChannelId, `Упало ${diff.diffCount} новых тестов :skull_and_crossbones:`);
        }
    }
});

(async () => {
    console.log('⚡️duty-bot готов к работе ⚡');
    await googleDocService.start();
    await localTunnel(process.env.PORT || 3000, { subdomain: "vi-duty-bot7" }, function(err, tunnel) {
            console.log('localTunnel running on 3000')
        });
    await app.start(process.env.PORT || 3000);
})();