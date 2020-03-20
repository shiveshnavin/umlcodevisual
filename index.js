var express = require('express')
var app = express()
var path = require('path')

app.use(express.static(path.join(__dirname, './')));

app.all('/', function (req, res) {
    res.sendFile(path.join(__dirname, './index.html'));
})


app.all('/view', function (req, res) {
	if(req.body == undefined || req.body.code == undefined)
	{
		req.body={
			code:'[code]'
		}
	}
	var fs=require('fs');
	var html=""+fs.readFileSync('./view.html');
	html.replace('[{{code}}]',req.body.code);
	res.send(html);
})


app.listen(process.env.PORT || 4000, function () {
    console.log("Server Started At ", process.env.PORT || 4000)

})