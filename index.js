const express = require('express')
const expressLayouts = require('express-ejs-layouts')
const bodyParser = require('body-parser')
const {check, validationResult} = require('express-validator')
const bcrypt = require('bcrypt')
const session = require('express-session')
const fileupload = require('express-fileupload')
const Client = require('pg').Pool
const path = require('path');
const ejs = require('ejs')
const flash = require('connect-flash')
require('dotenv').config()

const urlencodedParser = bodyParser.urlencoded({extended:false})
const saltRounds = 10

const app = express()
const PORT = process.env.PORT || 8080;
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({extended: false}))
app.use(expressLayouts)
app.use(fileupload())
app.use(flash())
app.set('view engine', 'ejs')
app.use(session({
    secret: 'lessonkey',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 10 * 60 * 1000,
        secure: false
    }
}))

// DB COnnection
const conn = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE
})

conn.connect((err, res, release) => {
    if(err) {
        return console.error("Error in connecting to the database");
    }
    res.query("SELECT NOW()", (err, result) => {
        release()
        if(err) {
            return console.error("Error executing query");
        }
        console.log("Connected to the database!!");        
    })
})

app.get('/', async(req,res) => {
    res.render("index")
})

app.get('/administrator/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
        } else {
            res.redirect('/administrator/adminLogin'); 
        }
    });
});

app.get('/administrator/adminLogin', async(req,res) => {
    res.render('administrator/adminLogin', {
        errors: req.flash('errors'),
        success: req.flash('success'),
        messages: req.flash()
    })
})

app.post('/administrator/adminLogin', urlencodedParser, [
    check('email').notEmpty().withMessage('Email ID cannot be empty').isEmail().withMessage('Enter proper email ID [name@example.com]'),
    check('password', 'Password cannot be empty').notEmpty(),
], async(req,res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('errors', errors.array());
        return res.redirect('/administrator/adminLogin');
    }
    const {email, password} = req.body
    try {
        const result = await conn.query('SELECT * FROM registration WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            req.flash("invalid", "Invalid credentials");
            return res.redirect('/');
        }
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash("invalid", "Check EmailID and Password");
            return res.redirect('/administrator/adminLogin');
        }
        //req.session.firstname = user.firstname
        req.flash("valid", "Successfully Loggedin!!")
        return res.redirect("/administrator/dashboard")
    }
    catch(error) {
        console.error(error);
        req.flash("errors", "An error occurred while logging.");
        return res.redirect("/administrator/adminLogin")
    }
})

app.get('/administrator/dashboard', async(req, res) => {
    const { rows } = await conn.query('SELECT COUNT(*) AS count FROM registration UNION SELECT COUNT(*) AS count1 FROM inventories');
    const usersCount = rows[0].count;
    const inventoryCount = rows[1].count;
    res.render('administrator/dashboard', { 
        usersCount, 
        inventoryCount
     });
})

app.get('/administrator/viewMembers', async(req, res) => {
    const data = await conn.query(`SELECT * FROM registration ORDER BY id ASC`);
    res.render("administrator/viewMembers", {
        data: data.rows
    })
})

app.post('/administrator/filterMembers', async(req,res) => {
    const searchUser = req.body.searchUser
    const data = await conn.query('SELECT * FROM registration WHERE firstname LIKE $1 OR lastname LIKE $1', [`${searchUser}%`]);
    res.render("administrator/filterMembers", {
        data: data.rows,
        searchUser: searchUser
    })
})

app.get('/administrator/viewInventory', async(req, res) => {
    const data = await conn.query(`SELECT * FROM inventories ORDER BY inv_id ASC`);
    res.render("administrator/viewInventory", {
        data: data.rows
    })
})

app.post('/administrator/filterInventory', async(req,res) => {
    const searchCategory = req.body.inputCategory
    const data = await conn.query('SELECT * FROM inventories WHERE inv_category = $1', [searchCategory]);
    res.render("administrator/filterInventory", {
        data: data.rows,
        searchCategory: searchCategory
    })
})

app.get('/administrator/addInventory', (req, res) => {
    res.render('administrator/addInventory', {
        errors: req.flash('errors'),
        success: req.flash('success')
    })
})

app.post('/administrator/addInventory',  urlencodedParser,[
    check('invName','Inventory Name cannot be blank').notEmpty(),
    check('invDesc','Inventory Description cannot be blank').notEmpty(),
    check('invCategory', 'Inventory Category should be selected').isIn(['Book', 'Magazine', 'Newsletter']),
    check('invImg').custom((value, { req }) => { return req.files && req.files.invImg;}).withMessage('Please upload an image.')
], async (req, res) => {
    const errors = validationResult(req)
    if(!errors.isEmpty()) {
        req.flash('errors', errors.array());
        return res.redirect('/administrator/addInventory');
    }

    let {invName, invDesc, invCategory, invImg} = req.body

    try {
        let fileName = null;
        if (req.files && req.files.invImg) {
            const file = req.files.invImg;
            fileName = new Date().getTime().toString() + path.extname(file.name);
            const savepath = path.join(__dirname, 'public', 'images/inventories', fileName);
            await file.mv(savepath);
        }
        const result = conn.query(`INSERT INTO inventories (inv_name, inv_desc, inv_category, inv_img) VALUES ($1, $2, $3, $4) RETURNING *`,
            [invName, invDesc, invCategory, fileName]
        );
        req.flash("success", "Successfully Inserted!!")
        return res.redirect('/administrator/addInventory')
    }
    catch (error) {
        console.error(error);
        req.flash("errors", "An error occurred while adding inventory.");
        res.send('Error in uploading file')
        return res.redirect('/administrator/addInventory');
    }
})

app.get('/administrator/viewInventory', async(req, res) => {
    const data = await conn.query(`SELECT * FROM inventories ORDER BY inv_id ASC`);
    res.render("administrator/viewInventory", {
        data: data.rows
    })
})

app.get('/administrator/editInventory/:inv_id', async(req,res) => {
    try {
        const id = req.params.inv_id;
        const data = await conn.query('SELECT * FROM inventories WHERE inv_id = $1', [id]);

        if (data.rows.length > 0) {
            const inventory = data.rows[0]
            res.render('administrator/editInventory', { 
                data: data.rows[0],
                selectedCategory: inventory.inv_category,
                imageURL: inventory.inv_img
            });
        } else {
            res.status(404).send('Item not found');
        }
    } catch (error) {
        
        res.status(500).send('Internal server error');
    }
})  

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);    
})