const googleDocService = require('./google-doc.js');
const slackService = require('./slack-service');
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
        let diff = await slackService.getData(reportProdChannelId);
        console.log(diff)
        await slackService.sendReply(reportProdChannelId, `Сравнил с предыдущим тегом. Новые упавшие тесты:\n :point_down:`);
        let chunkCount = diff.chunkCount;
        for (let i = 0; i <= chunkCount; i++) {
            if (diff.message[i]) { let message = await diff.message[i].join('\n');
                await slackService.sendReply(reportProdChannelId, `\`\`\`${message}\`\`\``);}
        }

        if (diff.diffCount <= 5) {
            await slackService.sendReply(reportProdChannelId, `Упало ${diff.diffCount} новых тестов. Совсем чуть-чуть :pinching_hand:`);
        }
        if (diff.diffCount > 5 && diff.diffCount <= 30) {
            await slackService.sendReply(reportProdChannelId, `Упало ${diff.diffCount} новых тестов. Бывало и лучше :expressionless:`);
        } else if (diff.diffCount > 30 && diff.diffCount <= 60) {
            await slackService.sendReply(reportProdChannelId, `Упало ${diff.diffCount} новых тестов. Подозрительно много :face_with_spiral_eyes:`);
        } else if (diff.diffCount > 60) {
            await slackService.sendReply(reportProdChannelId, `Упало ${diff.diffCount} новых тестов. Похоже, у нас большая проблема :skull_and_crossbones:`);
        }
    }
});

(async () => {
    console.log('⚡️duty-bot готов к работе ⚡');
    await googleDocService.start();
    await app.start(process.env.PORT || 3003);
})();