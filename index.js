const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const ObjectId = require("mongodb").ObjectId;
const admin = require("firebase-admin");


const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())


const serviceAccount = require('./watch-shop-d8886-firebase-adminsdk-wvkva-b224ea6a13.json')

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jo0ws.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {
        }
    }
    next();
}

async function run() {
    try {
        await client.connect();
        const database = client.db('theToyShop')
        const productCollection = database.collection("products");
        const usersCollection = database.collection('users')
        const ordersCollection = database.collection('orders')
        const reviewCollection = database.collection('review')
        console.log('database connected successfully');

        //get all Product
        app.get('/addProduct', async (req, res) => {
            const result = await productCollection.find({}).toArray();
            res.json(result)
        })

        //add Product
        app.post("/addProduct", async (req, res) => {
            const result = await productCollection.insertOne(req.body);
            res.send(result)
        })

        // get single product by id
        app.get("/singleProduct/:id", async (req, res) => {
            const result = await productCollection
                .find({ _id: ObjectId(req.params.id) })
                .toArray();
            res.send(result[0]);
        });

        //delete a item from manage products
        app.delete('/allProducts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(query);
            res.json(result);
        });

        // insert orders 
        app.post("/addOrders", async (req, res) => {
            const result = await ordersCollection.insertOne(req.body);
            res.send(result);
        });

        //  get the  orders by email
        app.get("/myOrder", async (req, res) => {
            console.log(req.params.email);
            const email = req.query.email;
            const query = { email: email }
            const result = await ordersCollection.find(query).toArray();
            res.send(result);
        });

        /// get all orders
        app.get("/allOrders", async (req, res) => {
            const result = await ordersCollection.find({}).toArray();
            res.send(result);
        });


        // status update
        app.put("/statusUpdate/:id", async (req, res) => {
            const filter = { _id: ObjectId(req.params.id) };
            const result = await ordersCollection.updateOne(filter, {
                $set: {
                    status: req.body.status,
                },
            });
            res.send(result);
        });

        //delete manage orders and orders   
        app.delete('/allOrders/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(query);
            // console.log(result);
            res.json(result);
        });

        //review get
        app.get("/allReview", async (req, res) => {
            const result = await reviewCollection.find({}).toArray();
            res.send(result);
        })

        // review post
        app.post("/addReview", async (req, res) => {
            const result = await reviewCollection.insertOne(req.body);
            res.send(result);
        });

        //check that if email is admin or not 
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })


        // add users data separately in a new collection
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            // console.log(result)
            res.json(result)

        })

        //filtered the data if user exist or not, exist then not added again, not exist then add user to db
        app.put('/users', async (req, res) => {
            const user = req.body;
            // console.log("put", user)
            const filter = { email: user.email }
            const options = { upsert: true };
            const updateDoc = { $set: user }
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.json(result)

        })

        // update  the value of make an admin field with JWT 
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    // console.log(result);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }
        })
    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from the Watch shop!')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})