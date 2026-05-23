import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';

console.log('xss-clean export:', typeof xss);
if (typeof xss === 'object') {
    console.log('xss default:', typeof xss.default);
}
console.log('mongoSanitize export:', typeof mongoSanitize);
if (typeof mongoSanitize === 'object') {
    console.log('mongoSanitize default:', typeof mongoSanitize.default);
}
