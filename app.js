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
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();
const convertStateTableToResponseTable = (eachState) => {
  return {
    stateId: eachState.state_id,
    stateName: eachState.state_name,
    population: eachState.population,
  };
};
const convertDistrictTableToResponseTable = (eachDistrict) => {
  return {
    districtId: eachDistrict.district_id,
    districtName: eachDistrict.district_name,
    stateId: eachDistrict.state_id,
    cases: eachDistrict.cases,
    cured: eachDistrict.cured,
    active: eachDistrict.active,
    deaths: eachDistrict.deaths,
  };
};
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//GET ALL STATES API 1
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStates = `
        SELECT
            *
        FROM
            state;`;
  const allStates = await db.all(getAllStates);
  response.send(
    allStates.map((statesAll) => convertStateTableToResponseTable(statesAll))
  );
});
//GET PARTICULAR STATE API 2
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getUniqueState = `
    SELECT
        *
    FROM 
        state
    WHERE
        state_id = ${stateId};`;
  const uniqueState = await db.get(getUniqueState);
  response.send(convertStateTableToResponseTable(uniqueState));
});
//CREATE A TABLE API 3
app.post("/districts/", authenticateToken, async (request, response) => {
  const {
    districtName,
    districtId,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = request.body;
  const createTable = `
    INSERT INTO
        district (district_name, state_id, cases, cured, active, deaths)
    VALUES (
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}');`;
  const newTable = await db.run(createTable);
  response.send("District Successfully Added");
});
//GET UNIQUE DISTRICT API 4
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getUniqueDistrict = `
    SELECT 
        *
    FROM 
        district
    WHERE 
        district_id = ${districtId};`;
    const uniqueDistrict = await db.get(getUniqueDistrict);
    response.send(convertDistrictTableToResponseTable(uniqueDistrict));
  }
);
//DELETE A TABLE FROM DISTRICT API 5
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
        DELETE FROM 
            district
        WHERE 
            district_id = ${districtId};`;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);
//UPDATE DISTRICT TABLE API 6
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrict = `
        UPDATE 
            district
        SET
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE 
            district_id = ${districtId}; `;
    await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);
//GET TOTAL CASES API 7
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const totalCases = `
    SELECT 
        sum(district.cases) as totalCases,
        sum(district.cured) as totalCured,
        sum(district.active) as totalActive,
        sum(district.deaths) as totalDeaths
    FROM 
        district
    WHERE 
        state_id = ${stateId};`;
    const getTotal = await db.get(totalCases);
    response.send(getTotal);
  }
);

module.exports = app;
