const express = require('express')
const app = express()
const cors = require('cors')
let mongoose = require('mongoose');
let bodyParser = require('body-parser');
let isoDate = require('isodate');
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

mongoose.connect(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true });

function isValidDate(d) {
  console.log(d instanceof Date, isNaN(d))
  return d instanceof Date && !isNaN(d);
}

const userSchema = mongoose.Schema({
  username: { type: String, required: true }
});

const User = mongoose.model("User", userSchema);

const exerciseSchema = mongoose.Schema({
  description: {type: String, required: true},
  duration: {type: Number, required: true},
  date: {type: Date,
          validate: {
            validator: function(v) {
              return v instanceof Date && !isNaN(v);
            },
            message: props => `${props.value} is not a valid date!`
          }
        },
  user_id: mongoose.ObjectId
});

const Exercise = mongoose.model("Exercise", exerciseSchema);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

//add user
app.post('/api/users', function(req, res) {
  let usrname = req.body["username"];
  let usrReq = { username: usrname }
  console.log(usrname);
  let results = createAndSaveUser(usrReq, function(request, result) {
    console.log("request:" + request, "result:" + result);
    res.json({username: result["username"], _id: result["_id"]})
    return result;
  });
});

const createAndSaveUser = (user, done) => {
  User.create(user, function(err, data) {
    if (err) return done(err);
    return done(null, data);
  });
}

//add exercises for a specific user
app.post('/api/users/:_id/exercises', function(req, res){
  let desc = req.body["description"];
  let dur = req.body["duration"];
  let dt = new Date(req.body["date"]);
  let id = req.params._id;
  let exReq = {description: desc, duration: dur, date: dt, user_id: id};

  let results = createAndSaveExercise(exReq, function(request, result) {
    findUserById(id, function(usrReq, usrRes){
      console.log(request, result, usrRes);
      res.json({
        username: usrRes["username"], 
        description: result["description"], 
        duration: result["duration"], 
        date: new Date(result["date"]).toDateString(), 
        _id: usrRes["_id"]
        });
    });
  });
});

const createAndSaveExercise = (rec, done) => {
  Exercise.create(rec, function(err, data) {
    if (err) return done(err);
    return done(null, data);
  });
};

const findUserById = (id, done) => {
  User.findById(id, function(err, data){
    if(err) return done(err);
    return done(null, data);
  });
}

//get all exercises for a specific user from a specific date (and possibly to another date and also possibly limited to a certain number of exercises)
app.get('/api/users/:_id/logs/', function(req,res){
  let id = req.params._id;
  let from = req.query.from;
  let to = req.query.to;
  let limit = req.query.limit;
  let parms = {id: id, from: from, to: to, limit: limit};
  findExercise(parms, function(exReq, exRes){
    findUserById(id, function(usrReq, usrRes){
      let logArr = exRes.map(a=>{
        a = {
          description: a["description"],
        duration: a["duration"],
        date: new Date(a["date"]).toDateString()
        }
        return a;
      });
      let returnObj = {
        username: usrRes["username"],
        count: exRes.length,
        _id: usrRes["_id"],
        log: logArr
      };
      console.log(returnObj);
      res.json(returnObj);
    });
  });
});

const findExerciseById = (id, done) => {
  Exercise.find({user_id: id}, function(err, data){
    if(err) return done(err);
    return done(null, data);
  });
}

const findExercise = (parms, done) => {
  let query = Exercise.find();
  query = query.where({user_id: parms["id"]});
  let dateObj = {};
  if (parms["from"] !== undefined){
    console.log(new Date(parms["from"]).toISOString());
    dateObj["$gte"] = new Date(parms["from"]).toISOString();
  }
  if (parms["to"] !== undefined){
    console.log(new Date(parms["to"]).toISOString());
    dateObj["$lte"] = new Date(parms["to"]).toISOString();
  }
  if(dateObj.hasOwnProperty("$gte") || dateObj.hasOwnProperty("$lte"))
    query = query.where({date: dateObj});
  if (parms["limit"] !== undefined){
    query = query.limit(Number(parms["limit"]));
  }
  query = query.select('description duration date');
  console.log(query["options"], query["_conditions"]);
  query.exec(function(err, data){
    if(err) return done(err);
    done(null, data);
    });
}

//get all users and their _id's 
app.get('/api/users/getAllUsers', (req, res, done) => {
  let users = User.find(function(err, data) {
    if (err)
      return done(err);
    console.log(data);
    return res.json(data);
  });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
