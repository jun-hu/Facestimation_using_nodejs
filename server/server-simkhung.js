// 묘둘 추출
var express        = require('express');
var bodyParser     = require('body-parser');
var mysql		   = require('mysql');
var app            = express();
var crypto	       = require('crypto');
var session        = require('express-session');
var socketio = require('socket.io');
var gcm = require('node-gcm');
require('date-utils');

//Now server would listen on port 8080 for new connection
var server = app.listen(8080);
console.log('채팅 서버 및 웹 서버 열림!');


//학교 목록
var list = [
	{
		name : '경희대학교',
		'공과대학' : ['기계공학과','산업경영공학과','원자력공학과', '화학공학과', '정보전자신소재공학과', '사회기반시스템공학과', '건축공학과', '환경공학과', '건축학과'],
		'전자정보대학' : ['전자전파공학과', '
		컴퓨터공학과', '생체의공학과'],
		'응용과학대학' : ['응용수학과', '응용물리학과', '응용화학과', '우주과학과'],
		'생명과학대학' : ['유전공학과', '식품생명공학과', '한방재료공학과', '식물환경신소재공학과','원예생명공학과'],
		'국제대학' : ['국제학과'],
		'예술디자인대학' : ['산업디자인학과', '시각정보디자인학과', '환경조경디자인학과', '의류디자인학과','디지털콘텐츠학과','포스턴모던음악학과','연극영화학과','도예학과'],
		'체육대학' : ['체육학과','스포츠지도학과','스포츠의학과','골프산업학과','태권도학과'],
		'동서의과학과' : ['동서의과학과'],

	},
	{
		//name : '중앙대학교',
		//college : ['생명공학대학', '경영경제대학'],
		//major : ['국제물류학과', '시스템생명공학과']
	}
];


// 모듈 설정
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// CORS 설정
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Origin,Accept,X-Requested-With,Content-Type,Access-Control-Request-Method,Access-Control-Request-Headers,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

// 데이터베이스 설정
var client = mysql.createConnection({
	user: 'root',
	password: 'tunituni904',
	database: 'simkhung'
});

// 소켓 서버
var io = socketio.listen(server);
io.sockets.on('connection', function (socket) {


    // createroom 이벤트
    socket.on('EnterRoom', function (data) {
		var roomId = data.roomId;
		var user = data.user;


		// 유저가 roomId에 존재하는 유저인지 체크하는 과정이 필요하다.
		client.query('select 1 from rooms where `index`='+roomId+' and (`sender`='+decryption(user)+' or `receiver`='+decryption(user)+')', function(error, data){
			var string = JSON.stringify(data);
			var json =  JSON.parse(string);
			if(Object.keys(json).length == 1){

				// 읽음 표시를 지운다.
				client.query('select `school`, `college` , `major`  from `members` where `unique`='+decryption(user), function(error, data){
					// 마지막 메세지 중에 자신이 보내지 않은 메세지들을 찾는다.
					var school = data[0].school;
					var college = data[0].college;
					var major = data[0].major;
					client.query('select `messages` from rooms where `index`=' + roomId, function(error, data){
						var text = JSON.parse(data[0]['messages']); // 기존의 메세지 리스트
						for(key in text){
							for(k in text[key]){
								if(k != 'read' && (k != college + ' ' + major) && text[key]['read'] == 1){
									text[key]['read'] = '0';
								}
							}
						}
						text = mysql.escape(JSON.stringify(text));
						// 채팅 내용 업데이트
						client.query('UPDATE `rooms` set `messages` = ' + text + 'where `index`=' + roomId, function(error, data){
							client.query('select `messages` from rooms where `index`=' + roomId, function(error, data){
								io.sockets.in(roomId).emit('getMSG',data[0]['messages']);//자신포함 전체 룸안의 유저
							});
						});
					});
				});

				// 소켓 방으로 클라이언트를 입장시킨다.
				client.query('select `messages` from rooms where `index`=' + roomId, function(error, data){
					socket.join(roomId);
					io.sockets.in(roomId).emit('getMSG',data[0]['messages']);//자신포함 전체 룸안의 유저
				});
			}else{
				//response.send({message: '올바른 사용자가 아닙니다.',result: false});
			}
		});
    });

	// 메세지 보내는 이벤트
	socket.on('setMSG', function (data) {
		var roomId = data.roomId;
		var user = data.user;
		var message = data.message;


		client.query('select 1 from rooms where `index`='+roomId+' and (`sender`='+decryption(user)+' or `receiver`='+decryption(user)+')', function(error, data){
			var string = JSON.stringify(data);
			var json =  JSON.parse(string);
			if(Object.keys(json).length == 1){
				client.query('select `school`, `college` , `major`  from `members` where `unique`='+decryption(user), function(error, data){
					var school = data[0].school;
					var college = data[0].college;
					var major = data[0].major;

					client.query('select `messages` from rooms where `index`=' + roomId, function(error, data){
						var text = JSON.parse(data[0]['messages']); // 기존의 메세지 리스트
						var clientsList = io.sockets.adapter.rooms[roomId];
						var numClients = clientsList.length;

						// 새로 추가할 메세지 리스트
						var item = {};
						item[college + ' ' + major] = message;

						if(numClients == 2){
							item['read'] = '0';
						}else{
							item['read'] = '1';
						}
						item['time'] = thisTime();

						text.push(item);
						text = mysql.escape(JSON.stringify(text));

						// 채팅 내용 업데이트
						client.query('UPDATE `rooms` set `messages` = ' + text + 'where `index`=' + roomId, function(error, data){
							client.query('select `messages` from rooms where `index`=' + roomId, function(error, data){
								io.sockets.in(roomId).emit('getMSG',data[0]['messages']);//자신포함 전체 룸안의 유저

								// 푸쉬 알람 gcm
								// sender
								client.query('select `sender_regid` from `rooms` where `sender`=' + decryption(user), function(error, data){
									string = JSON.stringify(data);
									json =  JSON.parse(string);
									if(Object.keys(json).length != 0){
										client.query('select `receiver_regid` from `rooms` where `index`=' + roomId, function(error, data){
											//console.log(data[0]['receiver_regid']);
											SendPush(college + ' ' + major,message,data[0]['receiver_regid']);
										});
									}
								});

								// receiver
								client.query('select `receiver_regid` from `rooms` where `receiver`=' + decryption(user), function(error, data){
									string = JSON.stringify(data);
									json =  JSON.parse(string);
									if(Object.keys(json).length != 0){
										client.query('select `sender_regid` from `rooms` where `index`=' + roomId, function(error, data){
											//console.log(data[0]['sender_regid']);
											SendPush(college + ' ' + major,message,data[0]['sender_regid']);
										});
									}
								});

							});
						});

					});
				});
			}else{
				response.send({message: '올바른 사용자가 아닙니다.',result: false});
			}
		});
	});
});


// 라우터 설정
var router = express.Router();


//회원 조회
router.get('/manager', function(request, response, next) {
	console.log('manager');
});

// 첫번째 로그인 창에서 아이디를 검사한다.
router.post('/id_check', function(request, response, next) {
	var id = mysql.escape(request.param('id'));
	var english = /^[A-Za-z0-9+]*$/;
	if(!english.test(request.param('id'))){
		response.send({message: '아이디는 영어 대소문자와 숫자만 가능합니다.',result: false});
	}else{
		client.query('select 1 from members where id=' + id, function(error, data){
			var string = JSON.stringify(data);
			var json =  JSON.parse(string);
			if(Object.keys(json).length == 1){
				response.send({message: '이미 존재하는 아이디입니다.',result: false});
			}else if(Object.keys(json).length == 0){
				response.send({message: '',result: true});
			}
		});
	}
});

// 회원가입
router.post('/sign_up', function(request, response, next) {

	var id,password,name,gender,school,college,major,grade;
	var english = /^[A-Za-z0-9+]*$/;

	if(request.param('id') == "" || !english.test(request.param('id'))|| request.param('password') == ""|| request.param('name') == "" || request.param('gender') == ""	|| request.param('school') == "" || request.param('college') == ""|| request.param('major') == ""|| request.param('grade') == ""){
		response.send({message: '모든 정보를 입력해주세요',result: false});
		return next();
	}else{
		id = mysql.escape(request.param('id'));
		password = mysql.escape(request.param('password'));
		name = mysql.escape(request.param('name'));
		gender = mysql.escape(Number(request.param('gender')));
		school = mysql.escape(request.param('school'));
		college = mysql.escape(request.param('college'));
		major = mysql.escape(request.param('major'));
		grade = mysql.escape(Number(request.param('grade')));

		// 암호화
		password = password.split("'").join("");
		var cipher = crypto.createCipher('aes256', 'simkhung_is_made_by_JTH[15]_in_KHLUG');
		cipher.update(password,'ascii','hex');
		var cipherd = "'"+cipher.final('hex') + "'";


		if(isNaN(grade) || isNaN(gender) || !checkForValue(list, school) || !checkForValue(list, college) || !checkForValue(list, major)|| (gender != 0 && gender != 1)|| (grade < 5 && grade > 16)){
			response.send({message: '회원가입 에러',result: false});
		}else{
			client.query('select 1 from members where id=' + id, function(error, data){
				var string = JSON.stringify(data);
				var json =  JSON.parse(string);
				if(Object.keys(json).length == 0){
					var generator = new IDGenerator();
					var uniqueID = generator.generate();
					console.log(uniqueID);
					client.query('INSERT INTO members (`id`,`password`,`name`,`gender`,`school`,`college`,`major`,`grade`,`unique`) VALUES ('+id+','+cipherd+','+name+','+gender+','+school+','+college+','+major+','+grade+','+uniqueID+')', function(error, data){
						if(gender == 0){
							client.query('INSERT INTO boys (`name`,`school`,`college`,`major`,`grade`,`unique`) VALUES ('+name+','+school+','+college+','+major+','+grade+','+uniqueID+')', function(error, data){
								response.send({message: '회원가입 성공',result: true});
							});
						}else if(gender == 1){
							client.query('INSERT INTO girls (`name`,`school`,`college`,`major`,`grade`,`unique`) VALUES ('+name+','+school+','+college+','+major+','+grade+','+uniqueID+')', function(error, data){
								response.send({message: '회원가입 성공',result: true});
							});
						}
					});
				}else{
					response.send({message: '회원가입 에러 : 없는 학교,단과대,전공명',result: false});
				}
			});
		}
	}

});

// 로그인
router.post('/login', function(request, response, next) {
	var id,password;
	var english = /^[A-Za-z0-9+]*$/;

	if(request.param('id') == "" || !english.test(request.param('id')) || request.param('password') == ""){
		response.send({message: '모든 정보를 입력해주세요',result: false});
		return next();
	}else{
		id = mysql.escape(request.param('id'));
		password = mysql.escape(request.param('password'));

		// 암호화
		password = password.split("'").join("");
		var cipher = crypto.createCipher('aes256', 'simkhung_is_made_by_JTH[15]_in_KHLUG');
		cipher.update(password,'ascii','hex');
		var cipherd = "'"+cipher.final('hex') + "'";

		client.query('select 1 from members where id='+id+' and password='+cipherd, function(error, data){
			var string = JSON.stringify(data);
			var json =  JSON.parse(string);
			if(Object.keys(json).length == 1){
				// 로그인 성공
				// 세션 주기 유니크 아이디
				client.query('select `unique` from members where id=' + id, function(error, data2){
					string = JSON.stringify(data2);
					json =  JSON.parse(string);

					// 휴대폰 registration_id을 members 테이블에 넣는다.
					var registration_id = mysql.escape(request.param('registration_id'));
					client.query('UPDATE `members` SET `registration_id`= '+registration_id+' where `unique`=' + json[0].unique, function(error, data2){});
					client.query('select `gender` from `members` where `unique`=' + json[0].unique, function(error, data3){
						if(data3[0].gender == 0){
							client.query('UPDATE `boys` SET `registration_id`= '+registration_id+' where `unique`=' + json[0].unique, function(error, data4){});
						}else if(data3[0].gender == 1){
							client.query('UPDATE `girls` SET `registration_id`= '+registration_id+' where `unique`=' + json[0].unique, function(error, data4){});
						}
					});


					response.send({message: encryption(json[0].unique),result: true});
				});
			}else{
				response.send({message: '아이디 또는 비밀번호가 일치하지 않습니다.',result: false});
			}
		});
	}
});

router.get('/room_list', function(request, response, next) {
	// 사용자를 체크한다.
	var user = mysql.escape(decryption(request.param('session')));
	client.query('select *  from `rooms` where `sender`='+user+' or `receiver`='+user, function(error, data){
		var string = JSON.stringify(data);
		var json =  JSON.parse(string);
		if(Object.keys(json).length != 0){
			var list = [];
			for(key in data){
				var msg = data[key].messages;
				var item = {
					roomId: data[key].index,
					lastmsg: JSON.parse(msg)[JSON.parse(msg).length-1]
				};
				list.push(item);
			}
			response.send(list);
		}else{
			response.send({result: false});
		}
	});
});


// 랜덤 방 생성
router.post('/send', function(request, response, next) {
	var session;
	var sender, sender_name, sender_school, sender_college, sender_major, sender_grade, sender_gender, sender_regid;
	var receiver , receiver_name, receiver_school, receiver_college, receiver_major, receiver_grade, receiver_gender, receiver_regid;
	var gender,school,college;
	var text; // 메세지 내용
	if(request.param('session') == "" || request.param('gender') == "" || request.param('school') == "" || request.param('college') == "" || request.param('text') == ""){
		response.send({message: '모든 정보를 입력해주세요',result: false});
		return next();
	}else{
		// 세션 검사
		client.query('select 1 from members where `unique`=' + decryption(request.param('session')), function(error, data){
			//console.log(decryption(request.param('session')));
			var string = JSON.stringify(data);
			var json =  JSON.parse(string);
			if(Object.keys(json).length == 1){
				client.query('select * from members where `unique`=' + decryption(request.param('session')), function(error, data){
					string = JSON.stringify(data);
					json =  JSON.parse(string);

					var temp_sender_school = data[0].school;
					var temp_sender_college = data[0].college;
					var temp_sender_major = data[0].major;

					sender = mysql.escape(decryption(request.param('session')));
					sender_name = mysql.escape(data[0].name);
					sender_school = mysql.escape(data[0].school);
					sender_college = mysql.escape(data[0].college);
					sender_major = mysql.escape(data[0].major);
					sender_grade = mysql.escape(data[0].grade);
					sender_gender = mysql.escape(data[0].gender);
					sender_regid = mysql.escape(data[0].registration_id);

					// 받을 사람을 정한다.
					gender = mysql.escape(Number(request.param('gender')));
					school = mysql.escape(request.param('school'));
					college = mysql.escape(request.param('college'));

					if(isNaN(gender) || !checkForValue(list, school) || !checkForValue(list, college) || (gender != 0 && gender != 1)){
						response.send({message: '전송 에러',result: false});
					}else{
						client.query('select * from members where gender='+gender+' and school='+school+' and college='+college+' and `unique` not in ('+ sender +') order by rand() limit 1', function(error, data){
							// 없으면 예외처리
							var string = JSON.stringify(data);
							var json =  JSON.parse(string);
							if(Object.keys(json).length != 0){

								receiver = mysql.escape(data[0].unique);
								receiver_name = mysql.escape(data[0].name);
								receiver_school = mysql.escape(data[0].school);
								receiver_college = mysql.escape(data[0].college);
								receiver_major = mysql.escape(data[0].major);
								receiver_grade = mysql.escape(data[0].grade);
								receiver_gender = mysql.escape(data[0].gender);
								receiver_regid = mysql.escape(data[0].registration_id);

								text = [];
								var item = {};
								item[temp_sender_college + ' ' + temp_sender_major] = request.param('text');
								item['read'] = '1';
								item['time'] = thisTime();

								text.push(item);
								text = mysql.escape(JSON.stringify(text));
								console.log(text);
								// rooms 데이터베이스에 데이터를 추가한다.
								client.query('INSERT INTO rooms (`sender`,`sender_name`,`sender_school`,`sender_college`,`sender_major`,`sender_grade`,`sender_gender`,`receiver`,`receiver_name`,`receiver_school`,`receiver_college`,`receiver_major`,`receiver_grade`,`receiver_gender`,`messages`, `sender_regid`,`receiver_regid`) VALUES ('+sender+','+sender_name+','+sender_school+','+sender_college+','+sender_major+','+sender_grade+','+sender_gender+','+receiver+','+receiver_name+','+receiver_school+','+receiver_college+','+receiver_major+','+receiver_grade+','+receiver_gender+','+text+','+sender_regid+','+receiver_regid+')', function(error, data){
									console.log('[info]:',sender,'(',sender_name,sender_school,sender_college,sender_major,sender_grade,(sender_gender == 0)? '남자':'여자',') 님이 ',receiver,'(',receiver_name,receiver_school,receiver_college,receiver_major,receiver_grade,(receiver_gender == 0)? '남자':'여자',') 님과 채팅방을 만들었습니다.');
									response.send({message: data.insertId,result: true});
								});
							}else{
								// 멤버가 없으면 ㅠㅠ
								// 사람수가 적어서
							}
						});
					}
				});
			}else if(Object.keys(json).length == 0){
				response.send({message: '정의되지 않은 유니크키',result: false});
			}
		});
	}
});

//JSON 값을 찾아주는 함수
function checkForValue(json, value) {
	value = value.split("'").join("");
    if(JSON.stringify(json).indexOf(value) > -1){
		return true;
	}else{
		return false;
	}
}

function encryption(input){
	// 암호화
	var cipher = crypto.createCipher('aes192', 'simkhung_is_made_by_JTH[15]_in_KHLUG')
	cipher.update(input, 'utf8', 'base64');
	return cipher.final('base64');
}
function decryption(input){
	// 암호화 해제
	var decipher = crypto.createDecipher('aes192', 'simkhung_is_made_by_JTH[15]_in_KHLUG');
	decipher.update(input, 'base64', 'utf8');
	return decipher.final('utf8');
}

function SendPush(main, msg ,mobilekey){

	var message = new gcm.Message();
	var message = new gcm.Message({
		collapseKey: 'demo',
		delayWhileIdle: true,
		timeToLive: 3,
		data: {
			title: main,
			message: msg
		}
	});

	var sender = new gcm.Sender('AIzaSyB710stemBUjZeyXWhSgpnpXdsopnJnJkU');
	var registrationIds = [];

	var registration_id = mobilekey;
	registrationIds.push(registration_id);

	/**
	 * Params: message-literal, registrationIds-array, No. of retries, callback-function
	 **/
	sender.send(message, registrationIds, 4, function (err, result) {
		console.log(result);
	});
}

// 중복안하는 숫자 알고리즘
function IDGenerator() {
	this.length = 8; // 랜덤 숫자 자리수
	this.timestamp = +new Date;
	var _getRandomInt = function( min, max ) {
	return Math.floor( Math.random() * ( max - min + 1 ) ) + min;
	}
	this.generate = function() {
	 var ts = this.timestamp.toString();
	 var parts = ts.split( "" ).reverse();
	 var id = "";

	 for( var i = 0; i < this.length; ++i ) {
		var index = _getRandomInt( 0, parts.length - 1 );
		id += parts[index];
	 }
	 return id;
	}
}

function thisTime(){
	var dt = new Date();
	return dt.toFormat('YYYY-MM-DD HH24:MI:SS');
}

app.use('/', router);
