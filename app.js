const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401).send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//GET users API
app.get("/", async (request, response) => {
  const getUsersQuery = `SELECT * FROM user`;
  const usersDetails = await db.all(getUsersQuery);
  response.send(usersDetails);
});

//API 1 login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400).send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400).send("Invalid password");
    }
  }
});

//API 2
//Returns a list of all states in the state table
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesQuery = `
    SELECT 
        state_id as stateId,
        state_name as stateName,
        population as population
    FROM state;`;
  const stateDetails = await db.all(getAllStatesQuery);
  response.send(stateDetails);
});

//API 3
// Returns a state based on the state ID
app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getParticularStateQuery = `
        SELECT 
            state_id as stateId,
            state_name as stateName,
            population as population            
        FROM state WHERE state_id = ${stateId};
    `;
  const stateDetails = await db.get(getParticularStateQuery);
  response.send(stateDetails);
});

//API 4
//Create a district in the district table, district_id is auto-incremented
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {districtName,stateId,cases,cured,active,deaths} = districtDetails;
  const insertDistrictQuery = `
    INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});
    `;
  await db.run(insertDistrictQuery);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId",authenticateToken,async (request,response)=>{
    const {districtId} = request.params;
    const getParticularDistrictQuery = `
        SELECT 
            district_id as districtId,
            district_name as districtName,
            state_id as stateId,
            cases as cases,
            cured as cured,
            active as active,
            deaths as deaths
        FROM
            district
        WHERE district_id = ${districtId};`;
    const particularDistrict = await db.get(getParticularDistrictQuery);
    response.send(particularDistrict);    
});

app.delete("/districts/:districtId/",authenticateToken,async (request,response)=>{
    const {districtId} = request.params;
    const deleteParticularDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteParticularDistrictQuery);
    response.send("District Removed");
});

app.put("/districts/:districtId",authenticateToken,async (request,response)=>{
    const {districtId} = request.params;
    const {districtName,stateId,cases,cured,active,deaths} = request.body;
    const updateDistrictDetailsQuery = `
        UPDATE district
        SET 
          district_name = '${districtName}',
          state_id = ${stateId},
          cases = ${cases},
          cured = ${cured},
          active = ${active},
          deaths = ${deaths}
        WHERE 
          district_id = ${districtId};`;
    await db.run(updateDistrictDetailsQuery);
    response.send("District Details Updated");
})

//API 8
//GET statistics of total cases, active, deaths of specific state based on state ID
app.get("/states/:stateId/stats/",authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatsQuery = `
        SELECT
            SUM(cases) as totalCases,
            SUM(cured) as totalCured,
            SUM(active) as totalActive,
            SUM(deaths) as totalDeaths
        FROM
            district
        WHERE
            state_id = ${stateId}
        GROUP BY state_id;`;
  const stats = await db.get(getStatsQuery);
  response.send(stats);
});

app.get("/districts/",authenticateToken,async (request,response)=>{
    const getAllDistrictQuery = `SELECT * FROM district`;
    const allDistrictDetails = await db.all(getAllDistrictQuery);
    response.send(allDistrictDetails);
});

module.exports = app;
