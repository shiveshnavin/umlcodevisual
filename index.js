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

var x=`#arrowSize : 0.7
#arrowSize: 0.5
#edges: hard 
#lineWidth: 1
#spacing: 30
#title: Determination Engine
#font: helvetica
#fontSize: 10
#visual:frame 
#stroke:#000 
#fill:#fff
#.comp : #visual:frame 
#gutter :1


[HheadQuater]->[Building 1]
[HheadQuater]->[Building 2]
[HheadQuater]->[Building 3|[Floor 1|desk1 | desk2 ]]
[HheadQuater]--[<state>Highway]
[Highway]-->[<database>Building 4]
[Building 1]-->[<abstract>garden]

`;

var x2=`#arrowSize : 0.7

[HheadQuater]->[Building 1]
[HheadQuater]->[Building 2]
[HheadQuater]->[Building 3|[Floor 1|desk1 | desk2 ]]
[HheadQuater]--[<state>Highway]
[Highway]-->[<database>Building 4]
[Building 1]-->[<abstract>garden]

`;
