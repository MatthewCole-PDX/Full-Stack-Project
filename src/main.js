// This file will be the main router
// that handles get and post requests
// to the website, and so it launches all
// pages

// handle backend connections (node)
const express = require("express");
const path = require("path");
var parser = require("body-parser");
// heroku has an environment variable
// that determines port
const PORT = process.env.PORT || 5000;
// pool controls connections to the postgres db
const { Pool } = require("pg");
const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require("constants");
const { title } = require("process");
const pool = new Pool({
  connectionString:
    "postgres://sajfopicqfjqpa:0207c07d082bbe7f11ebc9fe5e8dafb13796b05c0ea7a336d47ba14ecd57bef4@ec2-52-207-124-89.compute-1.amazonaws.com:5432/dc1qe778cvpm8r",
  ssl: {
    rejectUnauthorized: false,
  },
});

app = express();

app.use(
  parser.urlencoded({
    extended: false,
    limit: 1024,
  })
);

var loggedIn = false;
var username = undefined;
var user_id = undefined

// load all of the files
app.use(express.static(path.join(__dirname + "/public")));
app.set("views", __dirname + "/public/frontend");
app.set("view engine", "pug");

app.get("/", async (req, res) => {
  res.status(200);
  var searchResults = [];
  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT users.user_name, games.game_id, games.name, ratings.user_rating, ratings.user_review " +
        "FROM users " +
        "JOIN ratings " +
        "ON users.user_id = ratings.user_id " +
        "INNER JOIN releases " +
        "ON releases.release_id = ratings.release_id " +
        "INNER JOIN games " +
        "ON releases.game_id = games.game_id " +
        "WHERE ratings.user_review IS NOT NULL;"
    );
    const results = { results: result ? result.rows : null };
    let data = result.rows;
    for (let i = 0; i < data.length; i++) {
      var reviews = {
        user_name: data[i].user_name,
        game_id: data[i].game_id,
        name: data[i].name,
        user_rating: data[i].user_rating,
        user_review: data[i].user_review,
      };
      searchResults.push(reviews);
    }
    res.render("index", {
      title: "index",
      reviewData: searchResults,
      loggedIn: loggedIn,
    });
    //console.log(searchResults[0].user_name);
    client.release();
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
});

// add possibility for manual navigation
app.get("/chart", async (req, res) => {
  res.status(200);
  var searchResults = [];
  try {
    const client = await pool.connect();

    // note that the view 'top' is the query
    // SELECT name, AVG(user_rating) AS avg
    // FROM ratings
    // NATURAL JOIN releases
    // NATURAL JOIN Games
    // GROUP BY name
    // ORDER BY avg;
    // 'top2' is the same but with game_id instead of name
    const result = await client.query(
      "SELECT * " + "FROM top " + "NATURAL JOIN top2 " + "ORDER BY avg;"
    );
    const results = { results: result ? result.rows : null };
    let data = result.rows;
    for (let i = data.length - 1; i >= 0; i--) {
      var rating = {
        game_id: data[i].game_id,
        name: data[i].name,
        user_rating: data[i].avg,
      };
      searchResults.push(rating);
    }
    // if (!loggedIn) {
    // } else {
    //   //send logged in version of chart.html
    // }
    res.render("chart", {
      reviewData: searchResults,
    });
    //console.log(searchResults[0].user_name);
    client.release();
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
});

app.get("/login", (req, res) => {
  res.status(200);
  // res.sendFile(path.join(__dirname + "/public/logIn.html"));
  res.render("login", {"Login_Failed": undefined});
  //not visible if logged in
});
app.post("/checkCredentials", async (req, res) => {
  res.status(200);
  console.log(req.body.name, req.body.password);
  if(loggedIn == false){
    try {
      const client = await pool.connect();
      var result = await client.query("SELECT user_id FROM users WHERE LOWER(user_name) = " + 
                                          "LOWER('" + req.body.name + "') AND password = '" + req.body.password + "';"
      );
      if (result.rows[0].user_id){
        user_id = result.rows[0].user_id;
        user_name = req.body.name;
        loggedIn = true;
        console.log('Logged In! user-' + user_id);
        res.render("loginSuccessful", {"user_name": user_name});
      }
      else{
        res.render("login", {"Login_Failed": " Login Failed, Please Try Again"
        });
        client.release();
      }
    }catch (err) {
        console.error(err);
        res.send("Error " + err);
    }
  }
});

app.get("/user/:username", async(req, res) => {
  res.status(200);  
  console.log('hello world');
  if(req.params.username){
    try{
      const client = await pool.connect();
      const result2 = await client.query("SELECT user_name, user_id, email, " +
                                        "birth_date, users.city AS city, users.country AS country, console_id, name " +
                                        "FROM users JOIN consoles ON consoles.console_id = users.favorite_console WHERE users.user_id = '" + user_id + "';");
      const result3 = await client.query("SELECT DISTINCT games.game_id AS game_id, games.name AS name, consoles.console_id AS console_id" +
      ", consoles.name AS Console, ratings.user_rating AS user_rating, ratings.user_review AS user_review" + 
      ", TO_CHAR(releases.release_date,'MM/DD/YYYY') AS First_Release, companies.company_id AS company_id, companies.name AS publisher, releases.region AS Region" +
      ", string_agg(DISTINCT genres.name, ', ') AS Genres" +
      " FROM games " +
      "JOIN releases ON games.game_id = releases.game_id " +
      "INNER JOIN consoles ON releases.console_id = consoles.console_id " +
      "INNER JOIN companies ON releases.publisher_id = companies.company_id " +
      "INNER JOIN genre_rel ON games.game_id = genre_rel.game_id " +
      "INNER JOIN genres ON genre_rel.genre_id = genres.genre_id " +
      "INNER JOIN ratings ON ratings.release_id = releases.release_id" + 
      " WHERE releases.first_release = 'yes' AND ratings.user_id = '" + user_id + "'" +
      " GROUP BY games.game_id, games.name, consoles.console_id, Console, releases.release_date, companies.company_id, companies.name, releases.region" +
      ";");
      var userLibrary = [];
      for (var i = 0; i < userRatings.rows.length; i++) {
        var userEntry = {
          game_id: result3.rows[i].game_id,
          game_name: result3.rows[i].name,
          user_rating: result3.rows[i].user_rating,
          user_review: result3.rows[i].user_review,
          console_id: result3.rows[i].console_id,
          console: result3.rows[i].console,
          release_date: result3.rows[i].release_date,
          publisher_id: result3.rows[i].publisher_id,
          publisher: result3.rows[i].publisher,
          region: result3.rows[i].region,
          genres: result3.rows[i].genres
        };
        userLibrary.push(userEntry);
      }
      var userInfo = {
          user_id: result2.rows[0].user_id,
          user_name: result2.rows[0].user_name,
          console_id: result2.rows[0].console_id,
          console: result2.rows[0].name,
          birth_date: result2.rows[0].birth_date,
          city: result2.rows[0].city,
          country: result2.rows[0].country,
      };
      console.log(userInfo);
      console.log(userLibrary);
      res.render("user", {
        "userLibrary": userLibrary,
        "userInfo": userInfo,
      });
    }catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  }
});

app.post("/newUserAdded", (req, res) => {
  res.status(200);
  client.connect();
  client.query(
    "INSERT INTO users(user_name, password, email) VALUES (req.body.name, req.body.password, req.body.email);"
  );
  if (err) throw err;
  client.end();
  res.sendFile(path.join(__dirname + "/public/newUserAdded.html"));
});

app.post("/search", async (req, res) => {
  res.status(200);
  var searchResults = [];
  if (req.body.category == "games") {
    try {
      const client = await pool.connect();
      const result = await client.query(
        //"SELECT * FROM games;"
        "SELECT DISTINCT games.game_id AS game_id, games.name AS name" +
          ", consoles.name AS Console" +
          ", TO_CHAR(releases.release_date,'MM/DD/YYYY') AS First_Release, companies.name AS Publisher, releases.region AS Region" +
          ", string_agg(DISTINCT genres.name, ', ') AS Genres" +
          " FROM games " +
          "JOIN releases ON games.game_id = releases.game_id " +
          "INNER JOIN consoles ON releases.console_id = consoles.console_id " +
          "INNER JOIN companies ON releases.publisher_id = companies.company_id " +
          "INNER JOIN genre_rel ON games.game_id = genre_rel.game_id " +
          "INNER JOIN genres ON genre_rel.genre_id = genres.genre_id " +
          "WHERE LOWER(games.name) LIKE LOWER('%" +
          req.body.searchFor +
          "%')" +
          " AND releases.first_release = 'yes'" +
          " GROUP BY games.game_id, games.name, Console, releases.release_date, Publisher, releases.region" +
          ";"
      );
      //var results = { results: result ? result.rows : null };
      //console.log(results);
      //res.render("search");
      for (var i = 0; i < result.rows.length; i++) {
        var game = {
          game_id: result.rows[i].game_id,
          name: result.rows[i].name,
          console: result.rows[i].console,
          "first release": result.rows[i].first_release,
          publisher: result.rows[i].publisher,
          region: result.rows[i].region,
          genres: result.rows[i].genres,
        };
        searchResults.push(game);
      }
      res.render("search", {
        games: searchResults,
      });
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  }
});

app.get("/game/:game_id", async (req, res) => {
  res.status(200);
  //res.send(req.params.game_id);
  var id = req.params.game_id;
  try {
    const client = await pool.connect();
    const result = await client.query(
      //"SELECT * FROM games;"
      "SELECT games.game_id AS game_id, games.name AS name, consoles.console_id AS Console_id, " +
        "consoles.name AS Console, TO_CHAR(releases.release_date,'MM/DD/YYYY') AS Release_date, " +
        "companies.company_id AS Publisher_id, companies.name AS Publisher, " +
        "(SELECT DISTINCT string_agg(companies.name, ', ') AS Developers FROM companies " +
        "JOIN developer_rel ON developer_rel.developer_id = companies.company_id " +
        "WHERE developer_rel.game_id = '" +
        id +
        "'), " +
        "(SELECT DISTINCT string_agg(designers.name, ', ') AS Designers FROM designers " +
        "JOIN designer_rel ON designers.designer_id = designer_rel.designer_id " +
        "INNER JOIN releases ON releases.release_id = designer_rel.release_id " +
        "WHERE releases.game_id = '" +
        id +
        "'), " +
        "(SELECT DISTINCT string_agg(genres.name, ', ') AS Genres FROM genres " +
        "JOIN genre_rel ON genres.genre_id = genre_rel.genre_id " +
        "WHERE genre_rel.game_id = '" +
        id +
        "'), " +
        "releases.region AS Region, releases.first_release, releases.release_id " +
        "FROM releases " +
        "JOIN games ON games.game_id = releases.game_id " +
        "INNER JOIN consoles ON releases.console_id = consoles.console_id " +
        "INNER JOIN companies ON releases.publisher_id = companies.company_id " +
        "WHERE releases.game_id = '" +
        id +
        "' " +
        "GROUP BY releases.release_id, games.game_id, games.name, consoles.Console_id, " +
        "Console, releases.release_date, companies.company_id, " +
        "companies.name, releases.region, releases.first_release " +
        "ORDER BY releases.release_date;"
    );
    //var results = { results: result ? result.rows : null };
    var secondaryReleases = [];
    var game;
    for (var i = 0; i < result.rows.length; i++) {
      if (result.rows[i].first_release == "yes") {
        game = {
          game_id: result.rows[i].game_id,
          name: result.rows[i].name,
          console_id: result.rows[i].console_id,
          console: result.rows[i].console,
          release_date: result.rows[i].release_date,
          publisher_id: result.rows[i].publisher_id,
          publisher: result.rows[i].publisher,
          developers: result.rows[i].developers,
          designers: result.rows[i].designers,
          region: result.rows[i].region,
          genres: result.rows[i].genres,
        };
      } else {
        var secondaryRelease = {
          game_id: result.rows[i].game_id,
          name: result.rows[i].name,
          console_id: result.rows[i].console_id,
          console: result.rows[i].console,
          release_date: result.rows[i].release_date,
          publisher_id: result.rows[i].publisher_id,
          publisher: result.rows[i].publisher,
          developers: result.rows[i].developers,
          designers: result.rows[i].designers,
          region: result.rows[i].region,
          genres: result.rows[i].genres,
        };
        secondaryReleases.push(secondaryRelease);
      }
    }
    console.log(secondaryReleases);
    res.render("game", {
      game: game,
      secondaryReleases: secondaryReleases,
    });
    client.release();
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
});

app.get("/console/:console_id", async (req, res) => {
  res.status(200);
  var id = req.params.game_id;
  try {
    const client = await pool.connect();
    const result = await client.query(
      //"SELECT * FROM games;"
      "SELECT consoles.console_id AS Console_id, " + 
          "consoles.name AS Console, " +
          "TO_CHAR(consoles.release_date,'MM/DD/YYYY') AS Release_date, " +
	        "companies.company_id AS Manufacturer_id, companies.name AS Manufacturer, " +
	        "consoles.region AS Region, generation.name " +
      "FROM consoles, companies " +
      "WHERE consoles.console_id = '" + id + "' AND consoles.manufacturer_id = companies.company_id;"
    );
    var console = {
      "console_id": result.rows[i].console_id,
      "console": result.rows[i].console,
      "release_date": result.rows[i].release_date,
      "manufacturer_id": result.rows[i].publisher_id,
      "manufacturer": result.rows[i].publisher,
      "region": result.rows[i].region,
    };
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
}
});

// create a chart given a query from the chart page
app.post("/gen", async (req, res) => {
  try {
    res.status(200);

    // log the inputs of the form the console
    console.log("Console: " + req.body.Console);
    console.log("Company: " + req.body.Company);
    console.log("Genre: " + req.body.Genre);

    // touch postgres DB server
    const client = await pool.connect();

    // generate query
    // use temp query for now
    const result = await client.query("SELECT * FROM users;");
    // const results = { results: result ? result.rows : null };
    console.log(result.rows);
    var len = result.rows.length;
    var game = [];
    for (var i = 0; i < len; i++) {
      game.push(result.rows[i]);
    }

    //temporarily insert the users to test functionality
    res.render("gen", { Results: game });
    // console.log(results);
    client.release();
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
});

app.listen(PORT, () => {
  console.log(
    "Server running at https://rateyourgames.heroku.com/ using port" + PORT
  );
});
