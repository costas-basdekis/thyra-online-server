const moment = require('moment');
const sleep = require('system-sleep');

let previousMoment = moment(), previousDate = new Date();
sleep(1);
while (true) {
  const nowMoment = moment(), nowDate = new Date();
  const diff = {
    moment: nowMoment.isSameOrBefore(previousMoment),
    iso: nowMoment.toISOString() <= previousMoment.toISOString(),
    date: nowDate <= previousDate,
    datePlus: +nowDate <= +previousDate,
  };
  const any = diff.moment || diff.iso || diff.date | diff.datePlus;
  if (any) {
    console.log('Discrepancy', {iso: nowMoment.toISOString(), date: nowDate, datePlus: +nowDate, oldIso: previousMoment.toISOString(), previousDate: previousDate, previousDatePlus: +previousDate}, diff);
  } else {
    console.log('OK', {iso: nowMoment.toISOString(), date: nowDate}, diff);
  }
  previousMoment = nowMoment;
  previousDate = nowDate;
  sleep(5 * 1000);
}
