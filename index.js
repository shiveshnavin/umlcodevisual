var express = require('express')
var app = express()
var path = require('path')
const bodyParser = require("body-parser");

app.use(express.static(path.join(__dirname, './')));

app.use(bodyParser.urlencoded({
    extended: true
}));


app.all('/', function (req, res) {
    res.sendFile(path.join(__dirname, './index.html'));
})


app.all('/view', function (req, res) {
	var cd =x;
	if(req.query.cd!==undefined)
		cd = x2;

	if(req.body == undefined || req.body.code == undefined)
	{
		req.body={
			code:cd
		}
	}
	var fs=require('fs'); 
	fs.readFile('./view.html', 'utf8', function (err,data) {
	  if (err) {
		return console.log(err);
	  }
	  var result = data.replace(/----code----/g, req.body.code);
	   res.send(result);
	
	});


})


app.listen(process.env.PORT || 4000, function () {
    console.log("Server Started At ", process.env.PORT || 4000)

})

var x=`[a]->[b]`;

var x2=`[a]->[b]
[b]-->[c]`;