const express = require("express");
const MySQLUsersService = require("./services/MySQL/MySQLUsersService");
const ServiceLocator = require("./services/ServiceLocator");
const UsersService = require("./services/UsersService");
const app = express();
app.use(express.json());
const port = 5050;

const databaseSetup = async () => {
	const exec = require("child_process").exec;

	const mysqlCMD = new Promise((resolve, reject) => {
		exec("mysql -u root < schema.sql", (error, stdout, stderr) => {
			if(stderr) {
				console.log("stderr");
				reject(new Error(stderr))
				return console.error(stderr);
			}
	
			if(error) {
				console.log("error");
				reject(error);
				return console.error(error);
			}

			resolve();
		});
	});

	try {
		await mysqlCMD;

		const connection = require("mysql").createConnection({
			host: "localhost",
			user: "root",
			database: "bitr"
		});

		const usersService = new MySQLUsersService(connection);

		await usersService.init();

		ServiceLocator.setService(UsersService.name, usersService);

		console.log("UsersService Intialized.");

		console.log("Database setup complete.");
	} catch (e) {
		throw new Error("Failed to setup database.");
	}
};

const main = () => {
	app.get("/users/:user_id", async (req, res) => {
		/**
		 * @type { UsersService }
		 */
		const userService = ServiceLocator.getService(UsersService.name);

		try {
			const { payload: user, error } = await userService.getUser(Number.parseInt(req.params.user_id));

			if(error) {
				// we want to distinguish between IError, and Error
				// IError is what we created which is just a typedef
				// it's not a real type, just a JSObject with code & message properties.
				// Error is a real class so the 'name' property will infact exist.
				// The reason why we want to distinguish is because if an error
				// is thrown, we do not want to leak information to the client this can be
				// a security problem.
				// This should be handled better.
				if(error.name) {
					// we need to be storying the req and error to an internal log file
					// so that we can reproduce and also address any errors.
					console.log(error);

					// For now, let's assume that if an error has occured that we have yet to see and handle,
					// let's panic with a 500.
					res.status(500).end();
				} else {
					// The user's request could not be fullfilled thus, we fallback
					// to a 400 Bad Request.
					res.status(400).json(error);
				}

			} else {
				res.status(200).json(user);
			}
		} catch(e) {
			// As mentioned above, these types of error need to be dealt with
			// by logging the request and also the error so we can address them
			// to prevent issues. For now, we will simply log to the console, so always come back
			// and check on the console and see if there are any issues.
			console.log(e);

			// As usual something terrible has happened here
			// we panic and relay a 500 error.
			res.status(500).end();
		}
	});

	app.get("/users", async (req, res) => {
		/**
		 * @type { UsersService }
		 */
		const usersService = ServiceLocator.getService(UsersService.name);

		try {
			const { payload: users, error } = await usersService.getAllUsers();

			if(error) {
				// This is bad, we don't have a way to determine what
				// went wrong at this point. We need to test different situtations
				// to see what could cause an error when trying to fetch data.
				// At this current point, we can say the user did nothing wrong, so this
				// is on us, ergo, 500 Internal Server Error is appropriate.
				res.status(500).json(error);
			} else {
				// When you start to have lots and lots of records
				// you should start thinking about "pagination" either
				// cursor or offet based.
				res
					.status(200)
					.json({
						count: users.length,
						users
					});
			}
		} catch(e) {
			// Something went VERY wrong, inspect the log
			// and add guards to prevent this from happening and
			// fail gracefully.
			console.log(e);
			res.status(500).end();
		}
	});

	app.post("/users", async (req, res) => {
		/**
		 * @type {UsersService}
		 */
		const usersService = ServiceLocator.getService(UsersService.name);

		try {
			const { payload: user, error } = await usersService.createUser(req.body);

			if(error) {
				res.status(400).json(error);
			} else {
				res
					.status(201)
					.json(
						user
					);
			}
	
		} catch(e) {
			console.log(e);
			res.status(500).end();
		}
	});

	app.delete("/users/:user_id", async (req, res) => {
		/**
		 * @type {UsersService}
		 */
		const usersService = ServiceLocator.getService(UsersService.name);

		try {
			const { payload, error } = await usersService.deleteUser(Number.parseInt(req.params.user_id));

			if(error) {
				// we relay a 404 since the resource does not exist,
				// how do you delete something that does not exist?
				res.status(404).json(error);
			} else {
				// we relay a 204 No Content, as this api
				// does not send anything back for confirmation the record deleted
				// that is what the status code is for.
				// Remember, 200s is a GOOD thing, 400s, and 500s are BAD.
				res.status(204).json(payload);

				// alternatively you could send back a 200 Ok
				// and a JSON message with some information, however,
				// for us it was not needed or nessesary.
			}
		} catch(e) {
			console.log(e);
			// something catastrophic happened and is not the fault of the user (pending)
			// but it is ours as developers, therefore return nothing and relay a 500 Internal Server Error.
			res.status(500).end();
		}
	});

	app.listen(port, () => {
		console.log(`Listening on port ${port}.`);
	});
};

// IIFE - Immediatly invoked function expression

(
	async () => {
		try {
			await databaseSetup();
			main();
		} catch(e) {
			console.log(e);
			
			process.exit(-1);
		}
	}
)();

// databaseSetup()
// 	.then(() => {
// 		console.log("Database setup success!");

// 		app.post("/users", (req, res) => {
// 			const connection = require("mysql").createConnection({
// 				host: "localhost",
// 				user: "root",
// 				database: "bitr"
// 			});

// 			const usersService = new MySQLUsersService(connection);

// 			usersService.createUser(req.body);

// 			res.end();
// 		});

// 		app.listen(port, () => {
// 			console.log(`Listening on port ${port}`);
// 		});
// 	})
// 	.catch((reason) => {
// 		console.log(reason);
// 	});