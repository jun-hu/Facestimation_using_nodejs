var express = require('express');
var bodyParser= require('body-parser');//post할때 필요
var multer = require('multer'); //업로드할 때 필요
var request = require('request');
var app=express();

var _storage = multer.diskStorage({ //이 객체의 프로퍼티는 2개갖고 있다.
   destination: function (req, file, cb) {
     cb(null, 'uploads/');//업로드 위치를 저장하는 path함수
   },
   filename: function (req, file, cb) {
    // cb(null, file.originalname); //저장할 파일명
      cb(null, 'mypic.jpg');
   }
 })
 var upload = multer({ storage: _storage})
app.locals.pretty = true;

app.engine('html', require('ejs').renderFile);
app.use(express.static('public'));
app.use('/user',express.static('uploads'));
app.set('views','./views');
app.set('view engine', 'html');
app.use(bodyParser.urlencoded({extended:false}));

app.get('/home', function(req,res){
  console.log("home");
  res.render('upload');
});

/*app.post('/uploads',upload.single('userfile'),function(req,res){

  upload(req,res,function(err) {
      if(err) {
          return res.end("Error uploading file.");
      }
      res.end("File is uploaded");
  });
  console.log(req.file);
  res.render('facedetection');

})*/
app.post('/uploads', upload.single('userfile'),function(req,res){


  console.log("uploads");
  console.log(req.file);

  res.render('facedetection');

});

app.listen(8080, function(){
  console.log("connnected, 8080 port!");
});
