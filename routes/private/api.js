const { v4 } = require('uuid');
const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');
const { isEmpty } = require('lodash');

const getUser = async function(req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }

  const user = await db.select('*')
    .from('se_project.sessions')
    .where('token', sessionToken)
    .innerJoin('se_project.users', 'se_project.sessions.userId', 'se_project.users.id')
    .innerJoin('se_project.roles', 'se_project.users.roleId', 'se_project.roles.id')
    .innerJoin('se_project.faculties', 'se_project.users.facultyId', 'se_project.faculties.id')
    .first();
  
  console.log('user =>', user)
  user.isStudent = user.roleId === roles.student;
  user.isAdmin = user.roleId === roles.admin;

  return user;
}
module.exports = function(app) {
  // Register HTTP endpoint to get all users
  app.get('/api/v1/users', async function(req, res) {
    const results = await db.select('*').from('users');
    return res.json(results)
  });
  app.get('/api/v1/courses/:courseId/drop', async function (req ,res){
    var courseId =req.params.courseId;
    const user = await getUser(req);
    const result = await  db.select('*')
    .from('se_project.enrollments')
    .where('userId', user.id)
    .where('courseId', courseId).del();
    return res.status(301).redirect('/courses');
  });

  app.get('/api/v1/courses/:courseId/delete', async function (req ,res){
    var courseId = req.params.courseId;
    const result = await  db.select('*')
    .from('se_project.courses')
    .where('id', courseId).del();
    return res.status(301).redirect('/courses');
  });

  app.post('/api/v1/adminAddUser', async function(req, res) {
    // Check if user already exists in the system
    const userExists = await db.select('*').from('se_project.users').where('email', req.body.email);
    if (!isEmpty(userExists)) {
      return res.status(400).send('user exists');
    }
    
    const newUser = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: req.body.password,
      facultyId: req.body.facultyId,
      roleId: req.body.roleId,
    };
    //console.log(req.body);
    console.log(newUser);
    try {
      const user = await db('se_project.users').insert(newUser).returning('*');
      return res.status(301).redirect('/users');
    } catch (e) {
      console.log(e.message);
      const faculties = await db.select('*').from('se_project.faculties');
      return res.render('add-user', { faculties, errorMessage: "error adding new user" });
    }
  });

};
