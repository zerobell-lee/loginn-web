var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var mysql = require('mysql');
var bwipjs = require('bwip-js');
var fs = require('fs');
var mqtt = require('mqtt');
var nodemailer = require('nodemailer');

var app = express();

var outfile = path.join(__dirname, 'barcode_img', 'barcode.png');

function genOtp() {
    otp = ''
    otp = otp + Math.floor(Math.random()*8)+1;
    for (i=0; i<12; i++) {
        otp = otp + Math.floor(Math.random()*9);
    }
    return otp;
}

var config = JSON.parse(fs.readFileSync('config.json', {encoding: 'utf8'}));


var transporter = nodemailer.createTransport(config['mailSetting']);
var mqttSetting = config['mqttSetting'];

app.use(express.static('public'));
app.use(bodyParser.urlencoded( { extended: false}));

app.locals.pretty = true;
app.set('view engine', 'pug');
app.set('views', './views_file');

app.listen(3000, function() {
    console.log('Server listening');
});

app.get('/barcode', function(req, res) {
    res.sendFile(path.join(__dirname, 'setPwd.html'));
});

app.post('/generate', function(req, res) {
    mailAddr = req.body.email;
    new_otp = genOtp()
    bwipjs.toBuffer({
        bcid: 'code128',
        text: new_otp,
        scale: 3,
        height: 10,
        backgroundcolor: 'FFFFFF',
        paddingwidth: '10',
        paddingheight: '10',
        includetext: true,
        textalign: 'center'}, function (err, png) {
        if (err) console.log(err);
        else {
            fs.writeFile(outfile, png, 'binary', function(err) {
                if (err) console.log(err);
                else {
                    console.log('completed');
                    client = mqtt.connect('mqtt://' + mqttSetting['host'], {username: mqttSetting['id'], password: mqttSetting['pass']});
                    client.on('connect', function() {
                        console.log('mqtt connected');
                        client.publish(mqttSetting['topic'], 'chpwd ' + new_otp, function (err) {
                            if (err) console.log(err);
                            else {
                                console.log('published : chpwd ' + new_otp);
                                mailOptions = {
                                    from: 'LogINN <snowscale@naver.com>',
                                    to: mailAddr,
                                    subject: '출입 바코드입니다',
                                    text: '예약해주셔서 감사합니다.',
                                    attachments: [
                                        {filename: 'new_barcode.png',
                                            path: outfile}]
                                };
                                transporter.sendMail(mailOptions, function(err, info) {
                                    if (err) console.log(err);
                                    else console.log('Sent!' + info.response);
                                    transporter.close()
                                });
                                client.end();
                                res.end('Generated');
                            }
                        });
                    });
                }
            });

        }
    });
});