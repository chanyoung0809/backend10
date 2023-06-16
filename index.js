const express = require("express");
const MongoClient = require("mongodb").MongoClient;
//데이터베이스의 데이터 입력,출력을 위한 함수명령어 불러들이는 작업
const app = express();
const port = 3000;

//ejs 태그를 사용하기 위한 세팅
app.set("view engine","ejs");
//사용자가 입력한 데이터값을 주소로 통해서 전달되는 것을 변환(parsing)
app.use(express.urlencoded({extended: true}));
app.use(express.json()) 
//css/img/js(정적인 파일)사용하려면 이코드를 작성!
app.use(express.static('public'));

/*
    passport  passport-local  express-session 설치후 불러오기
    로그인 검정 및 세션 생성에 필요한 기능 사용
*/
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

app.use(session({secret :'secret', resave : false, saveUninitialized: true}));
app.use(passport.initialize());
app.use(passport.session()); 

let db; //데이터베이스 연결을 위한 변수세팅(변수의 이름은 자유롭게 지어도 됨)

MongoClient.connect("mongodb+srv://cisalive:cisaliveS2@cluster0.cjlsn98.mongodb.net/?retryWrites=true&w=majority",function(err,result){
    //에러가 발생했을경우 메세지 출력(선택사항)
    if(err) { return console.log(err); }

    //위에서 만든 db변수에 최종연결 ()안에는 mongodb atlas 사이트에서 생성한 데이터베이스 이름
    db = result.db("board_final");

    //db연결이 제대로 됬다면 서버실행
    app.listen(port,function(){
        console.log(`서버연결 성공, 포트 번호는 ${port}번`);
    });

});
// 로그인시 검증 처리
passport.use(new LocalStrategy({
    usernameField:"memberid",
    passwordField:"memberpass",
    session:true,
    },      //해당 name값은 아래 매개변수에 저장
    function(memberid, memberpass, done) {
                    //회원정보 콜렉션에 저장된 아이디랑 입력한 아이디랑 같은지 체크                                 
      db.collection("members").findOne({ memberid:memberid }, function (err, user) {
        if (err) { return done(err); } //아이디 체크 시 코드(작업 X)
        if (!user) { return done(null, false); }  //아이디 체크 시 코드(작업 X)
        //비밀번호 체크 여기서 user는 db에 저장된 아이디의 비번값
        if (memberpass == user.memberpass) { // 비밀번호 체크 시 코드
            // 저장된 비밀번호가, 유저가 입력한 비밀번호와 같으면 if
            return done(null, user)
          } else {
            // 다르면 else
            return done(null, false)
          }
      });
    }
));

app.get("/",function(req,res){
    //ejs 페이지에 보내는 정보 변수이름(작명가능):회원정보 정보값
    res.render("index.ejs", {login:req.user});
});

//다른 서브페이지들도 로그인되어있는 상태 데이터 보내야 함
app.get("/board",function(req,res){
    //ejs 페이지에 보내는 정보 변수이름(작명가능):회원정보 정보값
    res.render("board_list.ejs", {login:req.user});
});

// 회원가입 페이지 화면으로 가기 위한 경로 요청
app.get("/join",function(req,res){
    res.render("join.ejs");
});

// 회원가입 데이터 db에 데이터 저장 요청
app.post("/joindb",function(req,res){
    // 아이디 -> memberid :아이디입력값
    // 비밀번호 -> memberpass : 비밀번호입력값
    db.collection("members").findOne({memberid:req.body.memberid},(err,member)=>{
        if(member){ //찾은 데이터값이 존재할 때(중복 있는 경우)
            // 자바스크립트 구문 삽입할 때 사용 가능
            res.send(`<script> alert("이미 가입된 아이디가 존재합니다."); location.href="/join"; </script>`)
            // 경고창을 띄우면서 원하는 경로로 이동시킬 땐 이렇게밖에 못씀(리다이렉트 안됨)
        }
        else{
            db.collection("count").findOne({name:"회원"},(err,result)=>{
                db.collection("members").insertOne({
                    memberno:result.memberCount,
                    memberid:req.body.memberid,
                    memberpass:req.body.memberpass
                },(err)=>{
                    db.collection("count").updateOne({name:"회원"},{$inc:{memberCount:1}},(err)=>{
                        res.send(`<script> alert("회원가입 완료"); location.href="/login";  </script>`)
                    });
                })
            })
        }
    })
});

//처음 로그인 했을 시 세션 생성 memberid는 데이터에 베이스에 로그인된 아이디
//세션 만들어줌
passport.serializeUser(function (user, done) {
    done(null, user.memberid)
  });
  
//다른 페이지(서브페이지,게시판 페이지 등 로그인 상태를 계속 표기하기 위한 작업)
//로그인이 되있는 상태인지 체크
passport.deserializeUser(function (memberid, done) {
// memberid<- 찾고자 하는 id : memberid<- 로그인했을 때 id
db.collection('members').findOne({memberid:memberid }, function (err,result) {
    done(null, result);
    })
}); 

// 로그인 화면페이지 경로요청
app.get("/login",(req,res)=>{
    res.render("login");
})

// 로그인 처리 요청 경로 (failureRedirect: 로그인 실패했을 때 경로 )
app.post("/logincheck", passport.authenticate('local', {failureRedirect : '/login'}), (req,res)=>{
    res.redirect("/") // 성공하면 메인페이지로 이동시킴
})

// 로그아웃처리 요청 경로
app.get("/logout",(req,res)=>{
    // 로그아웃 함수 적용 후 메인페이지로 이동
    // 로그아웃 함수는 서버의 세션을 제거해주는 역할
    req.logout(()=>{
        res.redirect("/")
    })
    
})

// 마이페이지 보여주는 경로
app.get("/mypage", (req,res)=>{
    // login:req.user
    res.render("mypage.ejs",{login:req.user})
})

// 회원 정보 수정 후 db에 수정 요청
app.post("/myupdate",(req,res)=>{
    // 수정페이지에서 입력한 기존 비밀번호와 로그인하고 있는 계정의 비밀번호가 일치하는지 비교
    if(req.body.originPass === req.user.memberpass){
        db.collection("members").updateOne({memberid:req.user.memberid},
            /*, 바꿀 거 줄줄이 객체로 삽입 가능*/
            {$set:{memberpass:req.body.changePass}}, (err)=>{
                res.redirect("/");
                // 메인페이지로 이동시키기 말고 다른 작업도 가능
            })
    }
    else{
        res.send(`<script>alert('기존 비밀번호와 일치하지 않습니다.'); location.href="/mypage"</script>`)
    }
})