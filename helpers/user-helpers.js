var db = require('../config/connection')
var collection = require('../config/collections')
const bcrypt = require('bcrypt')
var objectId = require('mongodb').ObjectId
const { ObjectId } = require('bson')
const { response } = require('express')
const Razorpay = require('razorpay')
const { PRODUCT_COLLECTION } = require('../config/collections')
const moment = require("moment")
require('dotenv').config()

var instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});



module.exports = {
    userSignup: async (userData) => {
        userData.status = true
        userData.coupons = []
        userData.createdAt = new Date(),
            userData.password = await bcrypt.hash(userData.password, 10)
        return await db.get().collection(collection.USER_COLLECTION).insertOne(userData)
    },
    checkPhone: (phone) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.USER_COLLECTION).findOne({ phone: phone }).then((response) => {
                resolve(response)
            })
        })
    },
    googleSignup: async (data) => {
        userData = {
            status: true,
            username: data.given_name,
            mail: data.email,
            coupons: [],
            createdAt: new Date()
        }
        await db.get().collection(collection.USER_COLLECTION).insertOne(userData)
        return await db.get().collection(collection.USER_COLLECTION).findOne(userData)

    },
    checkEmailExist: (email) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.USER_COLLECTION).findOne({ mail: email }).then((response) => {
                resolve(response)
            })
        })
    },
    EmailExist: (email) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.USER_COLLECTION).findOne({ mail: email }).then((response) => {
                resolve(response)
            })
        })
    },
    userDetails: (userId) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.USER_COLLECTION).findOne({ _id: ObjectId(userId) }).then((response) => {
                resolve(response)
            })
        })
    },
    adminLogin: async (adminData) => {
        let loginstatus = false
        let response = {}
        let admin = await db.get().collection(collection.ADMIN_COLLECTION).findOne({ username: adminData.username })
        if (admin) {
            const status = await db.get().collection(collection.ADMIN_COLLECTION).findOne({ $and: [{ username: { $eq: adminData.username } }, { password: { $eq: adminData.password } }] })
            if (status) {
                return { admin, status: true }

            } else {
                return null
            }

        } else {
            return null
        }

    },
    userLogin: async (userData) => {
        let loginstatus = false
        let response = {}
        let user = await db.get().collection(collection.USER_COLLECTION).findOne({ mail: userData.mail })

        if (user) {

            const status = await bcrypt.compare(userData.password, user.password)


            if (!status) {
                return { err: "Incorrect username or password", res: { status: false }, }

            } else if (status && !user.status) {
                return { err: "Blocked by Admin", res: { status: false } }

            } else {
                return { user, status }
            }

        } else {
            return {
                err: "User doesn't exist", res: { status: false }
            }
        }

    },
    usersDetails: () => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.USER_COLLECTION).find().toArray().then((newusers) => {
                resolve(newusers)
            })

        })
    },
    blockUser: (userId) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.USER_COLLECTION).updateOne({ _id: ObjectId(userId) }, [{ $set: { status: false } }]).then((response) => {
                resolve(response);
            })
        })
    },
    unblockUser: (userId) => {
        return new Promise(async (resolve, reject) => {
            db.get().collection(collection.USER_COLLECTION).updateOne({ _id: ObjectId(userId) }, [{ $set: { status: true } }]).then((response) => {
                resolve(response)
            })
        })
    },
    addtoBag: (prodId, userId) => {
        let proObj = {
            item: ObjectId(prodId),
            quantity: 1

        }
        return new Promise(async (resolve, reject) => {
            let userBag = await db.get().collection(collection.CART_COLLECTION).findOne({ user: ObjectId(userId) })
            if (userBag) {
                let proExist = userBag.products.findIndex(product => product.item == prodId)
                if (proExist != -1) {
                    db.get().collection(collection.CART_COLLECTION).updateOne({ user: ObjectId(userId), 'products.item': ObjectId(prodId) },
                        {
                            $inc: { 'products.$.quantity': 1 }
                        }
                    ).then(() => {
                        resolve()
                    })
                } else {
                    db.get().collection(collection.CART_COLLECTION).updateOne({ user: ObjectId(userId) },
                        {
                            $push: { products: proObj }
                        }
                    ).then((response) => {
                        resolve()
                    })
                }
            } else {
                let cartObj = {
                    user: objectId(userId),
                    products: [proObj]
                }
                db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response) => {
                    resolve()
                })
            }
        })
    },
    getMybag: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: ObjectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, product: 1, subtotal: { $multiply: ['$quantity', '$product.price'] }, offsubtotal: { $multiply: ['$quantity', '$product.offerprice'] }
                    }
                },
            ]).toArray()
            resolve(cartItems)
        })
    },
    getBagcount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let count = 0
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: ObjectId(userId) })
            if (cart) {
                count = cart.products.length
            }
            resolve(count)
        })
    },
    changeQuantity: (prodDetails) => {
        prodDetails.count = parseInt(prodDetails.count)
        prodDetails.quantity = parseInt(prodDetails.quantity)

        return new Promise((resolve, reject) => {
            if (prodDetails.count == -1 && prodDetails.quantity == 1) {
                db.get().collection(collection.CART_COLLECTION).updateOne({ _id: ObjectId(prodDetails.cart) },
                    {
                        $pull: { products: { item: ObjectId(prodDetails.product) } }
                    }
                ).then((response) => {
                    resolve({ removeProduct: true })
                })
            } else {
                db.get().collection(collection.CART_COLLECTION).updateOne({ _id: ObjectId(prodDetails.cart), 'products.item': ObjectId(prodDetails.product) },
                    {
                        $inc: { 'products.$.quantity': prodDetails.count }
                    }
                ).then((response) => {
                    resolve({ status: true })
                })
            }

        })
    },

    deletebagItem: async (cartDetails) => {
        let itemDetails = await db.get().collection(collection.CART_COLLECTION).updateOne({ _id: ObjectId(cartDetails.cart) },
            {
                $pull: { products: { item: ObjectId(cartDetails.product) } }
            }
        )
        return { deleteItem: true }
    },
    getTotalprice: (userId) => {
        return new Promise(async (resolve, reject) => {
            let totalPrice = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: ObjectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $multiply: ['$quantity', '$product.price'] } },
                    }
                }
            ]).toArray()
            if (totalPrice[0]) {
                resolve(totalPrice[0].total)
            } else {
                resolve(false)
            }
        })
    },
    getTotalofferprice: (userId) => {
        return new Promise(async (resolve, reject) => {
            let totalPrice = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: ObjectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                },
            ]).toArray()
            let offertotal = 0
            for (let i = 0; i < totalPrice.length; i++) {
                if (totalPrice[i].product.offerprice) {
                    offertotal += (totalPrice[i].product.offerprice * totalPrice[i].quantity)
                } else {
                    offertotal += (totalPrice[i].product.price * totalPrice[i].quantity)
                }
            }
            if (totalPrice[0]) {
                resolve(offertotal)
            } else {
                resolve(false)
            }
        })
    },
    addAddress: (userId, addressDetails) => {
        let address = {
            fullname: addressDetails.fullname,
            address: addressDetails.address,
            city: addressDetails.city,
            place: addressDetails.place,
            pincode: addressDetails.pincode,
            phone: addressDetails.phone
        }

        return new Promise(async (resolve, reject) => {
            let addCollection = await db.get().collection(collection.ADDRESS_COLLECTION).findOne({ user: ObjectId(userId) })
            if (addCollection) {
                // console.log("vanu");
                db.get().collection(collection.ADDRESS_COLLECTION).updateOne({ user: ObjectId(userId) },
                    {
                        $push: { address: address }
                    }).then((response) => {
                        resolve()
                    })
            } else {
                let addObj = {
                    user: objectId(userId),
                    address: [address]
                }
                await db.get().collection(collection.ADDRESS_COLLECTION).insertOne(addObj).then((response) => {
                    resolve()
                })
            }
        })
    },
    addBuyAddress: (userId, addressDetails) => {
        let address = {
            fullname: addressDetails.fullname,
            address: addressDetails.address,
            city: addressDetails.city,
            place: addressDetails.place,
            pincode: addressDetails.pincode,
            phone: addressDetails.phone
        }
        return new Promise(async (resolve, reject) => {
            let addCollection = await db.get().collection(collection.ADDRESS_COLLECTION).findOne({ user: ObjectId(userId) })
            if (addCollection) {
                // console.log("vanu");
                db.get().collection(collection.ADDRESS_COLLECTION).updateOne({ user: ObjectId(userId) },
                    {
                        $push: { address: address }
                    }).then((response) => {
                        resolve()
                    })
            } else {
                let addObj = {
                    user: objectId(userId),
                    address: [address]
                }
                await db.get().collection(collection.ADDRESS_COLLECTION).insertOne(addObj).then((response) => {
                    resolve()
                })
            }
        })
    },
    getAddress: async (userId) => {
        return new Promise(async (resolve, reject) => {
            let address = await db.get().collection(collection.ADDRESS_COLLECTION).aggregate([
                {
                    $match: { user: ObjectId(userId) }
                },
                {
                    $unwind: '$address'
                },
                {
                    $project: {
                        user: 1,
                        address: '$address',

                    }
                },
            ]).toArray()
            resolve(address)
        })
    },
    getSelectedAdd: async (userId, add) => {
        return new Promise(async (resolve, reject) => {
            let address = await db.get().collection(collection.ADDRESS_COLLECTION).findOne({ user: ObjectId(userId) }, { address: { $elemMatch: { address: add } } })
            address = address.address.filter((addr) => (addr.address === add))
            if (address[0]) {
                resolve(address)
            } else {
                resolve({ address: false })
            }
        })
    },
    deleteAddress: async (addId, userId, address) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.ADDRESS_COLLECTION).updateOne({ _id: ObjectId(addId), user: ObjectId(userId) }, {
                $pull: { address: { address: address } }
            }).then((response) => {
                resolve({ status: true })
            })
        })
    },
    placeOrder: (address, products, total, payment, user) => {
        return new Promise(async (resolve, reject) => {
            if (payment === 'COD') {
                var status = 'placed'
            } else if (payment === 'PAYPAL') {
                status = 'placed'
            } else {
                status = 'pending'
            }
            address = address[0]
            let order = {
                user: ObjectId(user),
                deliveryaddress: {
                    fullname: address.fullname,
                    address: address.address,
                    city: address.city,
                    place: address.place,
                    pincode: address.pincode,
                    phone: address.phone
                },
                products: products,
                paymentmethod: payment,
                amount: total,
                status: status,
                createdAt: new Date(),
                date: moment().format("dddd, MMMM Do YYYY, h:mm:ss a")
            }
            db.get().collection(collection.ORDER_COLLECTION).insertOne(order).then((response) => {
                resolve(response.insertedId)
                if (payment === 'COD') {
                    db.get().collection(collection.CART_COLLECTION).deleteOne({ user: ObjectId(user) })
                }
            })
        })
    },
    deleteFinalBag: (user) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.CART_COLLECTION).deleteOne({ user: ObjectId(user) }).then((response) => {
                resolve()
            })
        })
    },
    getSingleprice: (userId) => {
        return new Promise(async (resolve, reject) => {
            let totalPrice = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: ObjectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                    $project: {
                        total: { $sum: { $multiply: ['$quantity', '$product.price'] } },
                        product: 1,
                    }
                },
            ]).toArray()
            resolve(totalPrice)
        })
    },
    getSinglepriceAdmin: (orderId, orderdetails) => {
        return new Promise(async (resolve, reject) => {
            let totalPrice = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { _id: ObjectId(orderId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                    $project: {
                        total: { $sum: { $multiply: ['$quantity', '$product.price'] } },
                        quantity: 1,
                        product: 1,
                    }
                },
            ]).toArray()
            resolve(totalPrice)
        })
    },
    getMyOrders: (userId) => {
        return new Promise(async (resolve, reject) => {
            let orders = await db.get().collection(collection.ORDER_COLLECTION).find({ user: ObjectId(userId) }).sort({ createdAt: -1 }).toArray()
            resolve(orders)
        })
    }, getAdminOrders: (cartId) => {
        return new Promise(async (resolve, reject) => {
            let orders = await db.get().collection(collection.ORDER_COLLECTION).find({ _id: ObjectId(cartId) }).toArray()
            resolve(orders)
        })
    },
    getOneOrder: (cartId) => {
        return new Promise(async (resolve, reject) => {
            let orders = await db.get().collection(collection.ORDER_COLLECTION).find({ _id: ObjectId(cartId) }).toArray()
            resolve(orders)
        })
    },
    checkNumber: (phone) => {
        return new Promise(async (resolve, reject) => {
            let userNumber = await db.get().collection(collection.USER_COLLECTION).findOne({ phone: phone }).then((response) => {
                resolve(response)
            })
        })
    },
    orderDetailsAdmin: () => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION).find().sort({ createdAt: -1 }).toArray().then((orders) => {
                resolve(orders)
            })
        })
    },
    changestatus: (cartId, userId, status) => {
        return new Promise(async (resolve, reject) => {
            if (status === 'cancelled') {
                await db.get().collection(collection.ORDER_COLLECTION).updateOne({ _id: ObjectId(cartId) },
                    {
                        $set: { status: status, iscancelled: true }
                    }).then((response) => {
                        resolve({ status: true })
                    })
            } else if (status === 'delivered') {
                await db.get().collection(collection.ORDER_COLLECTION).updateOne({ _id: ObjectId(cartId) },
                    {
                        $set: { status: status, isdelivered: true }
                    }).then((response) => {
                        resolve({ status: true })
                    })
            } else {
                await db.get().collection(collection.ORDER_COLLECTION).updateOne({ _id: ObjectId(cartId) },
                    {
                        $set: { status: status, iscancelled: false, isdelivered: false }
                    }).then((response) => {
                        resolve({ status: true })
                    })
            }

        })
    },
    cancelOrder: (cartId, cancel) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.ORDER_COLLECTION).updateOne({ _id: ObjectId(cartId) },
                {
                    $set: { status: cancel }
                }).then((response) => {
                    resolve({ status: true })
                })
        })
    },
    buyNowprice: (proId) => {
        return new Promise(async (resolve, reject) => {
            let totalPrice = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: ObjectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                    $project: {
                        total: { $sum: { $multiply: ['$quantity', '$product.price'] } },
                        product: 1,
                    }
                },
            ]).toArray()
            resolve(totalPrice)
        })
    },
    buyPlaceOrder: (address, products, total, payment, user) => {
        let proObj = {
            item: products[0]._id,
            quantity: 1
        }
        return new Promise(async (resolve, reject) => {
            if (payment === 'COD') {
                var status = 'placed'
            } else if (payment === 'PAYPAL') {
                status = 'placed'
            } else {
                status = 'pending'
            }
            address = address[0]
            let order = {
                user: ObjectId(user),
                deliveryaddress: {
                    fullname: address.fullname,
                    address: address.address,
                    city: address.city,
                    place: address.place,
                    pincode: address.pincode,
                    phone: address.phone
                },
                products: [proObj],
                paymentmethod: payment,
                amount: total,
                status: status,
                createdAt: new Date(),
                date: moment().format("dddd, MMMM Do YYYY, h:mm:ss a")
            }
            db.get().collection(collection.ORDER_COLLECTION).insertOne(order).then((response) => {
                resolve(response.insertedId)
            })
        })
    },
    generateRazorpay: (orderId, total) => {
        return new Promise((resolve, reject) => {
            var options = {
                amount: total * 100,
                currency: "INR",
                receipt: "" + orderId
            };
            instance.orders.create(options, function (err, order) {
                if (err) {
                    console.log(err);
                } else {
                    resolve(order)
                }
            });
        })
    },
    verifyPayment: (details) => {
        return new Promise((resolve, reject) => {
            const crypto = require('crypto')
            let hmac = crypto.createHmac('sha256', 'XVG4NoBjwr1Ew3DDGItKnY33')
            hmac.update(details.payment.razorpay_order_id + '|' + details.payment.razorpay_payment_id)
            hmac = hmac.digest('hex')
            if (hmac == details.payment.razorpay_signature) {
                resolve()
            } else {
                reject()
            }
        })
    },
    changePaymentStatus: (orderId) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.ORDER_COLLECTION).updateOne({ _id: ObjectId(orderId) },
                {
                    $set: {
                        status: 'placed'
                    }
                }
            ).then(() => {
                resolve()
            })
        })
    },
    updateUsermail: (userId, email) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.USER_COLLECTION).updateOne({ _id: objectId(userId) }, {
                $set: {
                    mail: email,
                }
            }).then((response) => {
                resolve()
            })
        })
    },
    updateUserphone: (userId, number) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.USER_COLLECTION).updateOne({ _id: objectId(userId) }, {
                $set: {
                    phone: number
                }
            }).then((response) => {
                resolve()
            })
        })
    },
    createPassword: (userId, password) => {
        return new Promise(async (resolve, reject) => {
            let newpassword = await bcrypt.hash(password, 10)
            await db.get().collection(collection.USER_COLLECTION).updateOne({ _id: ObjectId(userId) },
                {
                    $set: {
                        password: newpassword
                    }
                }).then((response) => {
                    resolve()
                })
        })
    },
    passwordExist: (userId) => {
        return new Promise(async (resolve, reject) => {
            await db.get().collection(collection.USER_COLLECTION).findOne({
                _id: ObjectId(userId),
                password: { $exists: false }
            }).then((response) => {
                if (response != null) {
                    resolve(true)
                } else {
                    resolve(false)
                }

            })
        })
    },
    changePassword: (userId, pass) => {
        return new Promise(async (resolve, reject) => {
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: ObjectId(userId) })
            if (user) {
                const status = await bcrypt.compare(pass, user.password)
                if (status) {
                    resolve(true)
                } else {
                    resolve(false)
                }
            }
        })
    },
    addtoWishlist: (prodId, userId) => {
        let proObj = {
            item: ObjectId(prodId)

        }
        return new Promise(async (resolve, reject) => {
            let wishlist = await db.get().collection(collection.WISHLIST_COLLECTION).findOne({ user: ObjectId(userId) })
            if (wishlist) {
                let proExist = wishlist.products.findIndex(product => product.item == prodId)
                if (proExist != -1) {
                    resolve({ alreadyexist: true })

                } else {
                    db.get().collection(collection.WISHLIST_COLLECTION).updateOne({ user: ObjectId(userId) },
                        {
                            $push: { products: proObj }
                        }
                    ).then((response) => {
                        resolve({ added: true })
                    })
                }
            } else {
                let wishObj = {
                    user: objectId(userId),
                    products: [proObj]
                }
                db.get().collection(collection.WISHLIST_COLLECTION).insertOne(wishObj).then((response) => {
                    resolve({ added: true })
                })
            }
        })
    },
    getMyWishlist: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cartItems = await db.get().collection(collection.WISHLIST_COLLECTION).aggregate([
                {
                    $match: { user: ObjectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                }
            ]).toArray()
            resolve(cartItems)
        })
    },
    deletewishItem: async (wishDetails) => {
        let itemDetails = await db.get().collection(collection.WISHLIST_COLLECTION).updateOne({ _id: ObjectId(wishDetails.wishlist) },
            {
                $pull: { products: { item: ObjectId(wishDetails.product) } }
            }
        )
        return { deleteItem: true }
    },
    getSingle: (cartId, userId, prodId) => {
        return new Promise(async (resolve, reject) => {
            let single = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { _id: ObjectId(cartId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $match: { 'products.item': ObjectId(prodId) }
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $multiply: ['$quantity', '$product.price'] } },
                        offertotal: { $sum: { $multiply: ['$quantity', '$product.offerprice'] } }
                    }
                },
            ]).toArray()
            resolve(single)
        })
    }
}