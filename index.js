const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
require("dotenv").config();

// app.use(cors());
app.use(
  cors({
    origin: [
      "https://assignment-11-library-cloud-web-app.netlify.app",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);
app.use(express.json());

//DB SETUP START

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.Assignment_11_DB}:${process.env.Assignment_11_PASS}@cluster0.r4vhlna.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//firebase service key related code

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);

// const serviceAccount = require("./assignment-11-firebase-admin-service-key.json");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//FIREBASE TOKEN RELATED VERIFICATION START
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    // console.log("from try ",decoded)
    next();
  } catch (error) {
    res.status(401).send({ message: "Unauthorised access in catch section" });
  }
};
//FIREBASE TOKEN RELATED VERIFICATION ENDS
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // db and collection
    const allBooksCollections = client
      .db("Assignment_11_DB")
      .collection("AllBooks");
    const borrowBooksCollections = client
      .db("Assignment_11_DB")
      .collection("BorrowBooks");
    const usersCollection = client
      .db("Assignment_11_DB")
      .collection("AllUsers");

    // All Books related api start here
    app.post("/books", verifyFirebaseToken, async (req, res) => {
      const allBooks = req.body;
      const result = await allBooksCollections.insertOne(allBooks);
      res.send(result);
    });
    //GETTING ALL BOOKS START HERE
    app.get("/allBooks", async (req, res) => {
      const result = await allBooksCollections.find().toArray();
      res.send(result);
    });
    app.get("/categoryAllBooks", async (req, res) => {
      const result = await allBooksCollections.find().toArray();
      res.send(result);
    });
    app.get("/allBooks/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allBooksCollections.findOne(query);
      res.send(result);
    });
    //GETTING ALL BOOKS ENDS HERE
    //BORROW BOOK PAGE RETURN BTN FUNCTIONLITY API--INCREASE BOOKS QUANTITY
    app.patch(
      "/all-books/quantity/:id",
      verifyFirebaseToken,
      async (req, res) => {
        const id = req.params.id;
        console.log("from patch", req.decoded);
        console.log(id);
        const filter = { _id: new ObjectId(id) };
        console.log(filter);
        const updatedDocs = {
          $inc: {
            quantity: 1,
          },
        };
        const result = await allBooksCollections.updateOne(filter, updatedDocs);

        res.send(result);
      }
    );

    app.put("/all-books/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedBook = req.body;
      const updatedDoc = {
        $set: updatedBook,
      };
      const result = await allBooksCollections.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    //FOR MY NEED DELETE API FOR BOOK (OPTIONAL LATER WILL BE DELTED)
    app.delete("/allBooks-delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allBooksCollections.deleteOne(query);
      res.send(result);
    });

    //BORROW BOOK API
    app.post("/borrow-books/:bookId", verifyFirebaseToken, async (req, res) => {
      const id = req.params.bookId;
      const borrowBookData = req.body;
      // console.log("borrowbooks", borrowBookData);

      //test
      // STEP 1: Check if already borrowed
      const alreadyBorrowed = await borrowBooksCollections.findOne({
        bookId: id,
        userEmail: borrowBookData.userEmail,
      });

      if (alreadyBorrowed) {
        return res
          .status(400)
          .send({ message: "You already borrowed this item." });
      }
      //test ends

      const result = await borrowBooksCollections.insertOne(borrowBookData);
      if (result.acknowledged) {
        //update the qunatiy of books
        await allBooksCollections.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: {
              quantity: -1,
            },
          }
        );
      }
      res.send(result);
    });

    //GET ALL BORROWED BOOKS BY USER EMIAL
    app.get("/borrowed-books/:email", verifyFirebaseToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).res.send({ message: "FOrbidden access" });
      }

      const filter = { userEmail: email };
      const borrowedBooks = await borrowBooksCollections.find(filter).toArray();

      for (borrowBook of borrowedBooks) {
        const bookId = borrowBook.bookId;
        const query = { _id: new ObjectId(bookId) };

        const allBooksData = await allBooksCollections.findOne(query);
        borrowBook.title = allBooksData?.title;
        borrowBook.imageUrl = allBooksData?.imageUrl;
        borrowBook.quantity = allBooksData?.quantity;
        borrowBook.author = allBooksData?.author;
        borrowBook.category = allBooksData?.category;
        borrowBook.description = allBooksData?.description;
        borrowBook.rating = allBooksData?.rating;
      }
      res.send(borrowedBooks);
    });

    //DELETE BOOK FROM BORROW LIST CLICKING RETURN BTN
    app.delete("/borrowed-books/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await borrowBooksCollections.deleteOne(query);
      res.send(result);
    });

    //USER RELATED API START HERE
    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const userExist = await usersCollection.findOne({ email });
      if (userExist) {
        return res
          .status(200)
          .send({ message: "User already exists", inserted: false });
      }
      const userInfo = req.body;
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });
    app.get("/users/:email/role", async (req, res) => {
      try {
        const email = req.params.email;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({ role: user.role || "user" });
      } catch (error) {
        console.error("Error getting user role:", error);
        res.status(500).send({ message: "Failed to get role" });
      }
    });
    // app ALL USERS
    app.get('user',async(req,res)=>{
      const result=await usersCollection.find().toArray
      res.send(result)
    })
    //USER RELATED API ENDS HERE

    //BLOGS RELATED API START HERE

    //BLOGS RELATED API ENDS HERE

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//DB SETUP END
app.get("/", async (req, res) => {
  res.send("Assignment-11 Server IS Running and data is coming soon");
});

app.listen(port, () => {
  console.log(`Assignment 11 sever is running on port ${port}`);
});
