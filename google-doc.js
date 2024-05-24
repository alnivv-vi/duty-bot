
// class GoogleDocService {
//     async start() {
//         await this.fetchDutyData();
//     }
//
//     getActualDutyId() {
//         return this._dutyId;
//     }
//
//     async fetchDutyData() {
//         try {
//             const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
//                 method: 'GET',
//                 timeout: 5000,
//                 signal: new AbortController().signal
//             });
//             const data = await response.json();
//             this._dutyId = data.id;
//         } catch (error) {
//             console.error(error);
//         }
//     }
// }
//
// module.exports = (function () {
//     return new GoogleDocService();
// })();
//
